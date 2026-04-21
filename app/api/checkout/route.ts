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
    const { items, deliveryMethod } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 3. Execute Secure Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      // Fetch all products to verify prices and availability
      const productRefs = items.map(item => adminDb!.collection('products').doc(item.id));
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

        subtotal += data.price;
        validItems.push({
          id: snap.id,
          title: data.title,
          price: data.price,
          sellerId: data.sellerId,
          ref: snap.ref
        });
      }

      // Identify unique sellers for delivery calculation
      const uniqueSellers = new Set(validItems.map(item => item.sellerId)).size;
      const deliveryFee = deliveryMethod === 'delivery' ? (uniqueSellers * 2.00) : 0;
      
      // The platform fee is now handled on the seller's side (deducted from their payout), 
      // so the buyer ONLY pays the subtotal + delivery.
      const buyerTotalAmount = subtotal + deliveryFee;

      // 1. Deduct Total from Buyer Wallet Securely with Ledger
      await updateWalletWithLedger(transaction, {
        userId: buyerId,
        amount: -buyerTotalAmount,
        type: 'escrow_hold',
        description: `Cart checkout (${validItems.length} items) + Delivery`
      });

      const orderIds = [];
      let totalPlatformFeeHeld = 0;

      // 2. Create Orders and Update Products
      for (const item of validItems) {
        const orderRef = adminDb!.collection('orders').doc();
        orderIds.push(orderRef.id);
        
        // Calculate the platform fee per item (2% for students, could be higher for vendors later)
        const itemPlatformFee = item.price * 0.02;
        // The delivery fee per item can just be attributed to the order if they chose delivery
        const itemDeliveryFee = deliveryMethod === 'delivery' ? 2.00 : 0; // simplistic: per seller, assuming 1 item per seller for now, or just record it cleanly. 
        totalPlatformFeeHeld += itemPlatformFee;

        transaction.set(orderRef, {
          buyerId,
          sellerId: item.sellerId,
          productId: item.id,
          productTitle: item.title,
          amount: item.price, // Gross amount
          platformFee: itemPlatformFee, // What the platform takes
          netAmount: item.price - itemPlatformFee, // What the seller actually receives for the item
          status: 'escrow_held',
          deliveryMethod,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        transaction.update(item.ref, {
          status: 'sold',
          updatedAt: FieldValue.serverTimestamp()
        });

        // Create or update Chat using Idempotent / Deterministic IDs
        const deterministicChatId = `${buyerId}_${item.sellerId}_${item.id}`;
        const chatRef = adminDb!.collection('chats').doc(deterministicChatId);
        
        // Use set with merge so it works whether the chat already exists (e.g. they discussed the product first) or not.
        transaction.set(chatRef, {
          participants: [buyerId, item.sellerId],
          buyerId,
          sellerId: item.sellerId,
          orderId: orderRef.id,
          productId: item.id,
          productTitle: item.title,
          createdAt: FieldValue.serverTimestamp(),
          lastMessage: 'Order placed. Securely check delivery methods.',
          lastMessageAt: FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Add a system message indicating the start of Escrow
        const msgRef = adminDb!.collection(`chats/${deterministicChatId}/messages`).doc();
        transaction.set(msgRef, {
          chatId: deterministicChatId,
          senderId: 'system',
          text: `Checkout Alert: Escrow has received funds securely. \nDelivery Method Chosen: ${deliveryMethod === 'delivery' ? 'Dorm Delivery' : 'Campus Pickup'}`,
          isSystem: true,
          productId: item.id,
          status: 'sent',
          createdAt: FieldValue.serverTimestamp()
        });

        // Notify the Seller that they sold an item!
        const notifRef = adminDb!.collection('notifications').doc();
        transaction.set(notifRef, {
          userId: item.sellerId,
          title: 'New Order Received! 🎉',
          message: `Cha-ching! Someone just bought ${item.title}. The funds are safe in Escrow. Please prepare for shipment or pickup!`,
          type: 'order',
          link: '/vendor',
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
      transaction.update(userRef, {
        totalSpent: FieldValue.increment(buyerTotalAmount)
      });

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
