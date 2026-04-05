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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
        const { buyerId, items, deliveryMethod } = metadata;
        const totalAmount = items.reduce((sum: number, item: any) => sum + item.price, 0);
        
        const buyerRef = adminDb.collection('users').doc(buyerId);
        transaction.update(buyerRef, {
          totalSpent: FieldValue.increment(totalAmount)
        });

        for (const item of items) {
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

          const productRef = adminDb.collection('products').doc(item.id);
          transaction.update(productRef, { status: 'sold' });

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
