import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateWalletWithLedger } from '@/lib/ledger-admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const buyerId = decodedToken.uid;

    // 2. Parse Request Body
    const { items, useCoins } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 3. Execute Secure Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      // Fetch all products to verify prices and availability
      const productRefs = items.map(item => adminDb!.collection('products').doc(item.productId || item.id));
      const productSnaps = await transaction.getAll(...productRefs);

      let subtotal = 0;
      const validItems = [];

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i];
        if (!snap.exists) {
          throw new Error(`Product ${items[i].title} not found`);
        }
        const data = snap.data();
        if (!data) throw new Error(`Product ${items[i].title} data is empty`);
        if (data.status !== 'active') {
          // Allow checkout for ended auctions if the buyer is the winner
          if (data.type === 'auction' && data.status === 'ended') {
            // Verify the buyer is the winner
            const bidsRef = adminDb!.collection('bids')
              .where('auctionId', '==', snap.id)
              .orderBy('amount', 'desc')
              .limit(1);
            const bidsSnap = await transaction.get(bidsRef);
            
            if (bidsSnap.empty || bidsSnap.docs[0].data().bidderId !== buyerId) {
              throw new Error(`You are not the winner of the auction for ${data.title}`);
            }
            
            // Override price with the winning bid amount
            data.price = bidsSnap.docs[0].data().amount;
          } else {
            throw new Error(`Product ${data.title} is no longer available`);
          }
        }
        if (data.sellerId === buyerId) {
          throw new Error(`You cannot buy your own product: ${data.title}`);
        }

        let productPrice = data.price;
        const requestedQuantity = items[i].quantity || 1;
        
        if (data.hasVariations && items[i].id.includes('-')) {
          const variantIndex = parseInt(items[i].id.split('-')[1]);
          if (!isNaN(variantIndex) && data.variants && data.variants[variantIndex]) {
            const variant = data.variants[variantIndex];
            if (variant.price != null && variant.price !== undefined) {
              productPrice = variant.price;
            }
            if ((variant.quantity || 0) < requestedQuantity) {
              throw new Error(`Not enough stock for variant of ${data.title}`);
            }
          }
        } else {
          if ((data.quantity || 0) < requestedQuantity) {
            throw new Error(`Not enough stock for ${data.title}`);
          }
        }

        subtotal += productPrice * requestedQuantity;
        validItems.push({
          id: snap.id,
          cartItemId: items[i].id,
          title: data.hasVariations ? items[i].title : data.title,
          price: productPrice,
          quantity: requestedQuantity,
          sellerId: data.sellerId,
          ref: snap.ref,
          productData: data
        });
      }

      // Identify unique sellers for delivery calculation
      const uniqueSellers = new Set(validItems.map(item => item.sellerId)).size;
      const deliveryFee = 0; // Delivery is external
      
      // FETCH USERS FOR CHAT BEFORE WRITES (Transactions require reads before writes)
      const uniqueSellerIds = Array.from(new Set(validItems.map(item => item.sellerId)));
      const userRefs = [
        adminDb!.collection('users').doc(buyerId),
        ...uniqueSellerIds.map(id => adminDb!.collection('users').doc(id))
      ];
      const userSnaps = await transaction.getAll(...userRefs);
      const buyerData = userSnaps[0].data() || {};
      
      const coinDiscount = useCoins ? (buyerData.coins || 0) * 0.005 : 0;
      const buyerTotalAmount = Math.max(0, subtotal + deliveryFee - coinDiscount);

      const sellerDataMap: Record<string, any> = {};
      for (let i = 1; i < userSnaps.length; i++) {
        const snap = userSnaps[i];
        if (snap.exists) {
          sellerDataMap[snap.id] = snap.data() || {};
        }
      }

      // 1. Deduct Total from Buyer Wallet Securely with Ledger
      await updateWalletWithLedger(transaction, {
        userId: buyerId,
        amount: -buyerTotalAmount,
        type: 'escrow_hold',
        description: `Cart checkout (${validItems.length} items)`
      });

      const orderIds = [];
      let totalPlatformFeeHeld = 0;

      // 2. Create Orders and Update Products
      for (const item of validItems) {
        const orderRef = adminDb!.collection('orders').doc();
        orderIds.push(orderRef.id);
        
        // Calculate the platform fee per item (2% for students, could be higher for vendors later)
        const itemPlatformFee = item.price * item.quantity * 0.02;
        // The delivery fee per item can just be attributed to the order if they chose delivery
        const itemDeliveryFee = 0; // simplistic: per seller, assuming 1 item per seller for now, or just record it cleanly. 
        totalPlatformFeeHeld += itemPlatformFee;

        transaction.set(orderRef, {
          buyerId,
          sellerId: item.sellerId,
          productId: item.id,
          productTitle: item.title,
          amount: item.price * item.quantity, // Gross amount
          quantity: item.quantity,
          platformFee: itemPlatformFee, // What the platform takes
          netAmount: (item.price * item.quantity) - itemPlatformFee, // What the seller actually receives for the item
          status: 'escrow_held',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        // Calculate new quantity
        const productData = item.productData;
        let newTotalQuantity = productData.quantity || 1;
        let updateData: any = {
           updatedAt: FieldValue.serverTimestamp()
        };

        if (productData.hasVariations && item.cartItemId.includes('-')) {
          const variantIndex = parseInt(item.cartItemId.split('-')[1]);
          if (!isNaN(variantIndex) && productData.variants && productData.variants[variantIndex]) {
            const variants = [...productData.variants];
            variants[variantIndex] = {
               ...variants[variantIndex],
               quantity: Math.max(0, (variants[variantIndex].quantity || 0) - item.quantity)
            };
            updateData.variants = variants;
            newTotalQuantity = variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0);
          }
        } else {
          newTotalQuantity = Math.max(0, (productData.quantity || 0) - item.quantity);
        }

        updateData.quantity = newTotalQuantity;
        if (newTotalQuantity <= 0) {
           updateData.status = 'sold';
        }

        transaction.update(item.ref, updateData);

        // Create or update Chat using Idempotent / Deterministic IDs
        const deterministicChatId = `${buyerId}_${item.sellerId}_${item.id}`;
        const chatRef = adminDb!.collection('chats').doc(deterministicChatId);
        
        const sellerData = sellerDataMap[item.sellerId] || {};

        // Use set with merge so it works whether the chat already exists (e.g. they discussed the product first) or not.
        transaction.set(chatRef, {
          participants: [buyerId, item.sellerId],
          buyerId,
          sellerId: item.sellerId,
          orderId: orderRef.id,
          productId: item.id,
          productTitle: item.title,
          participantDetails: {
            [buyerId]: { name: buyerData.displayName || 'Buyer', photoURL: buyerData.photoURL || '', role: buyerData.role || 'student' },
            [item.sellerId]: { name: sellerData.displayName || 'Seller', photoURL: sellerData.photoURL || '', role: sellerData.role || 'vendor' }
          },
          createdAt: FieldValue.serverTimestamp(),
          lastMessage: 'Order placed. Securely check delivery methods.',
          lastMessageAt: FieldValue.serverTimestamp(),
          [`unreadCount.${item.sellerId}`]: FieldValue.increment(1)
        }, { merge: true });
        
        // Add a system message indicating the start of Escrow
        const msgRef = adminDb!.collection(`chats/${deterministicChatId}/messages`).doc();
        transaction.set(msgRef, {
          chatId: deterministicChatId,
          senderId: 'system',
          text: `Checkout Alert: Escrow has received funds securely. Please communicate to arrange delivery or pickup.`,
          isSystem: true,
          productId: item.id,
          status: 'sent',
          createdAt: FieldValue.serverTimestamp()
        });

        const sellerRole = sellerData.role || 'student';

        // Notify the Seller that they sold an item!
        const notifRef = adminDb!.collection('notifications').doc();
        transaction.set(notifRef, {
          userId: item.sellerId,
          title: 'New Order Received! 🎉',
          message: `Cha-ching! Someone just bought ${item.title}. The funds are safe in Escrow. Please prepare for shipment or pickup!`,
          type: 'order',
          link: sellerRole === 'vendor' ? '/vendor' : '/dashboard?tab=sales',
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      // 3. Record Public Transaction for Fees & Escrow Hold
      const txRef = adminDb!.collection('transactions').doc();
      transaction.set(txRef, {
        userId: buyerId,
        senderId: buyerId,
        receiverId: 'escrow',
        amount: buyerTotalAmount,
        type: 'escrow_hold',
        status: 'completed',
        description: `Order Payment (${validItems.length} item${validItems.length > 1 ? 's' : ''})`,
        createdAt: FieldValue.serverTimestamp()
      });

      // Update user total spent (including subtotal, not just delivery fee)
      const userRef = adminDb!.collection('users').doc(buyerId);
      const updateData: any = {
        totalSpent: FieldValue.increment(buyerTotalAmount),
        totalCoinsEarned: FieldValue.increment(Math.floor(buyerTotalAmount))
      };
      if (useCoins && (buyerData.coins || 0) > 0) {
        // Simple logic: If they use coins, wipe out their previous coins and just give them coins for this new purchase
        updateData.coins = Math.floor(buyerTotalAmount);
      } else {
        updateData.coins = FieldValue.increment(Math.floor(buyerTotalAmount));
      }
      transaction.update(userRef, updateData);

      return { success: true, orderIds };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process checkout' },
      { status: 400 }
    );
  }
}
