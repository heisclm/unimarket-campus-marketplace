import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateWalletWithLedger } from '@/lib/ledger-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Paystack secret key not configured' }, { status: 500 });
    }

    // 1. Verify with Paystack
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('Paystack API request timed out')), 10000); // 10s timeout

    let response;
    try {
      response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json();

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.json({ error: data.message || 'Payment verification failed' }, { status: 400 });
    }

    const paystackData = data.data;
    let metadata = paystackData.metadata || {};
    
    // Paystack sometimes returns metadata as a stringified JSON
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error('Failed to parse metadata string:', metadata);
      }
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // 2. Process Securely (Idempotent)
    const result = await adminDb.runTransaction(async (transaction) => {
      const lockRef = adminDb.collection('payment_locks').doc(reference);
      const lockSnap = await transaction.get(lockRef);

      if (lockSnap.exists) {
        return { alreadyProcessed: true };
      }

      if (metadata.type === 'cart_checkout') {
        const { buyerId, items } = metadata;
        const totalAmount = items.reduce((sum: number, item: any) => sum + item.price, 0);

        // FETCH USERS & PRODUCTS BEFORE WRITES
        const uniqueSellerIds = Array.from(new Set(items.map((item: any) => item.sellerId)));
        const userRefs = [
          adminDb.collection('users').doc(buyerId),
          ...uniqueSellerIds.map(id => adminDb.collection('users').doc(id as string))
        ];
        
        const productRefs = items.map((item: any) => adminDb.collection('products').doc(item.productId || item.id));

        const allRefs = [...userRefs, ...productRefs];
        const allSnaps = await transaction.getAll(...allRefs);
        
        const userSnaps = allSnaps.slice(0, userRefs.length);
        const productSnaps = allSnaps.slice(userRefs.length);

        const buyerData = userSnaps[0].data() as any || {};
        
        const sellerDataMap: Record<string, any> = {};
        for (let i = 1; i < userSnaps.length; i++) {
          const snap = userSnaps[i];
          if (snap.exists) {
            sellerDataMap[snap.id] = snap.data() || {};
          }
        }
        
        const productDataMap: Record<string, any> = {};
        for (let i = 0; i < productSnaps.length; i++) {
          const snap = productSnaps[i];
          if (snap.exists) {
            productDataMap[snap.id] = snap.data() || {};
          }
        }
        
        // Update buyer total spent
        const amountPaid = paystackData.amount / 100;
        const { useCoins } = metadata;
        
        const buyerRef = adminDb.collection('users').doc(buyerId);
        const updateData: any = {
          totalSpent: FieldValue.increment(amountPaid),
          totalCoinsEarned: FieldValue.increment(Math.floor(amountPaid))
        };
        if (useCoins && (buyerData.coins || 0) > 0) {
          updateData.coins = Math.floor(amountPaid);
        } else {
          updateData.coins = FieldValue.increment(Math.floor(amountPaid));
        }
        transaction.update(buyerRef, updateData);

        for (const item of items) {
          const requestedQuantity = item.quantity || 1;
          
          // Calculate the platform fee per item
          const itemPlatformFee = item.price * requestedQuantity * 0.02;

          // Create Order
          const orderRef = adminDb.collection('orders').doc();
          transaction.set(orderRef, {
            buyerId,
            sellerId: item.sellerId,
            productId: item.productId || item.id,
            productTitle: item.title,
            amount: item.price * requestedQuantity,
            quantity: requestedQuantity,
            platformFee: itemPlatformFee,
            netAmount: (item.price * requestedQuantity) - itemPlatformFee,
            status: 'escrow_held',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          // Record Transaction (Hold)
          const txDocRef = adminDb.collection('transactions').doc();
          transaction.set(txDocRef, {
            userId: buyerId,
            senderId: buyerId,
            receiverId: 'escrow',
            orderId: orderRef.id,
            amount: item.price * requestedQuantity,
            type: 'escrow_hold',
            status: 'completed',
            reference,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Update Product Status/Quantity
          const productRef = adminDb.collection('products').doc(item.productId || item.id);
          const productData = productDataMap[item.productId || item.id] || {};
          
          let newTotalQuantity = productData.quantity || 1;
          let updateData: any = {};
          
          if (productData.hasVariations && item.id.includes('-')) {
            const variantIndex = parseInt(item.id.split('-')[1]);
            if (!isNaN(variantIndex) && productData.variants && productData.variants[variantIndex]) {
              const variants = [...productData.variants];
              variants[variantIndex] = {
                 ...variants[variantIndex],
                 quantity: Math.max(0, (variants[variantIndex].quantity || 0) - requestedQuantity)
              };
              updateData.variants = variants;
              newTotalQuantity = variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0);
            }
          } else {
            newTotalQuantity = Math.max(0, (productData.quantity || 0) - requestedQuantity);
          }

          updateData.quantity = newTotalQuantity;
          if (newTotalQuantity <= 0) {
             updateData.status = 'sold';
          }
          transaction.update(productRef, updateData);

          // Create Chat
          const deterministicChatId = orderRef.id;
          const chatRef = adminDb.collection('chats').doc(deterministicChatId);
          
          const sellerData = sellerDataMap[item.sellerId] || {};

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
            lastMessage: 'Order placed. Start chatting with the seller!',
            lastMessageAt: FieldValue.serverTimestamp(),
            [`unreadCount.${item.sellerId}`]: FieldValue.increment(1)
          }, { merge: true });
          
          // Add a system message indicating the start of Escrow
          const msgRef = adminDb.collection(`chats/${deterministicChatId}/messages`).doc();
          transaction.set(msgRef, {
            chatId: deterministicChatId,
            senderId: 'system',
            text: `Checkout Alert: Escrow has received funds securely via Paystack. Please communicate to arrange delivery or pickup.`,
            isSystem: true,
            productId: item.id,
            status: 'sent',
            createdAt: FieldValue.serverTimestamp()
          });

          const sellerRole = sellerData.role || 'student';

          // Notify the Seller
          const notifRef = adminDb.collection('notifications').doc();
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

        // Handle fees
        const platformFee = (paystackData.amount / 100) - totalAmount;
        if (platformFee > 0) {
          const feeTxRef = adminDb.collection('transactions').doc();
          transaction.set(feeTxRef, {
            userId: buyerId,
            amount: platformFee,
            type: 'fee',
            status: 'completed',
            reference,
            description: 'Platform & Delivery Fees',
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      } else if (metadata.type === 'wallet_topup') {
        const { userId } = metadata;
        const amount = paystackData.amount / 100;

        await updateWalletWithLedger(transaction, {
          userId,
          amount,
          type: 'deposit',
          description: `Wallet Top-up via Paystack (Ref: ${reference})`
        });

        const txRef = adminDb.collection('transactions').doc();
        transaction.set(txRef, {
          userId,
          amount,
          type: 'deposit',
          status: 'completed',
          reference,
          description: 'Wallet Top-up',
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(lockRef, { 
        processedAt: FieldValue.serverTimestamp(),
        metadataType: metadata.type,
        amount: paystackData.amount / 100
      });

      return { success: true };
    });

    return NextResponse.json({
      status: 'success',
      alreadyProcessed: result.alreadyProcessed,
      metadata: metadata
    });
  } catch (error: any) {
    console.error('Paystack verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
