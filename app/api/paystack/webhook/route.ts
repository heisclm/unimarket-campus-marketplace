import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateWalletWithLedger } from '@/lib/ledger-admin';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Paystack secret key not configured' }, { status: 500 });
    }

    // Verify signature
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(body).digest('hex');
    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference;
      let metadata = data.metadata || {};

      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          console.error('Failed to parse metadata string:', metadata);
        }
      }

      if (!adminDb) {
        console.error('Firebase Admin not initialized');
        return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
      }

      // Use a transaction to ensure idempotency and atomicity
      const result = await adminDb.runTransaction(async (transaction) => {
        // 1. Check for idempotency using a dedicated lock collection
        const lockRef = adminDb.collection('payment_locks').doc(reference);
        const lockSnap = await transaction.get(lockRef);

        if (lockSnap.exists) {
          return { alreadyProcessed: true };
        }

        // 2. Process based on metadata type
        if (metadata.type === 'cart_checkout') {
          const { buyerId, items, deliveryMethod } = metadata;
          const totalAmount = items.reduce((sum: number, item: any) => sum + item.price, 0);
          
          // Update buyer total spent
          const buyerRef = adminDb.collection('users').doc(buyerId);
          transaction.update(buyerRef, {
            totalSpent: FieldValue.increment(totalAmount)
          });

          for (const item of items) {
            // Create Order
            const orderRef = adminDb.collection('orders').doc();
            transaction.set(orderRef, {
              buyerId,
              sellerId: item.sellerId,
              productId: item.id,
              productTitle: item.title,
              amount: item.price,
              status: 'escrow_held',
              deliveryMethod,
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
              amount: item.price,
              type: 'escrow_hold',
              status: 'completed',
              reference,
              createdAt: FieldValue.serverTimestamp(),
            });

            // Update Product Status
            const productRef = adminDb.collection('products').doc(item.id);
            transaction.update(productRef, { status: 'sold' });

            // Create Chat
            const chatRef = adminDb.collection('chats').doc();
            transaction.set(chatRef, {
              participants: [buyerId, item.sellerId],
              buyerId,
              sellerId: item.sellerId,
              orderId: orderRef.id,
              createdAt: FieldValue.serverTimestamp(),
              lastMessage: 'Order placed. Start chatting with the seller!',
              lastMessageAt: FieldValue.serverTimestamp(),
            });
          }

          // Handle fees
          const platformFee = (data.amount / 100) - totalAmount;
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
          const amount = data.amount / 100;

          // Update Wallet with Ledger
          await updateWalletWithLedger(transaction, {
            userId,
            amount,
            type: 'deposit',
            description: `Wallet Top-up via Paystack (Ref: ${reference})`
          });

          // Record Public Transaction
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

        // 3. Mark as processed
        transaction.set(lockRef, { 
          processedAt: FieldValue.serverTimestamp(),
          metadataType: metadata.type,
          amount: data.amount / 100
        });

        return { success: true };
      });

      if (result.alreadyProcessed) {
        return NextResponse.json({ message: 'Transaction already processed' }, { status: 200 });
      }
    }

    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
