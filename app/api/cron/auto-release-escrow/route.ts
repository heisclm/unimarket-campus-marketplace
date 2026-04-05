import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateWalletWithLedger } from '@/lib/ledger-admin';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // Auto-release escrow for orders delivered more than 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const deliveredOrdersSnap = await adminDb.collection('orders')
      .where('status', '==', 'delivered')
      .where('updatedAt', '<=', threeDaysAgo)
      .get();

    if (deliveredOrdersSnap.empty) {
      return NextResponse.json({ message: 'No orders to auto-release', count: 0 });
    }

    let count = 0;

    // Process each order in a transaction to ensure ledger integrity
    for (const doc of deliveredOrdersSnap.docs) {
      const orderData = doc.data();
      const orderId = doc.id;

      try {
        await adminDb.runTransaction(async (transaction) => {
          const orderRef = adminDb!.collection('orders').doc(orderId);
          const orderSnap = await transaction.get(orderRef);

          if (!orderSnap.exists) return;
          const currentData = orderSnap.data();
          
          if (currentData?.status !== 'delivered') return; // State changed

          const sellerId = currentData.sellerId;
          const amount = currentData.amount;

          // 1. Update Seller Wallet Securely with Ledger
          await updateWalletWithLedger(transaction, {
            userId: sellerId,
            amount: amount,
            type: 'escrow_release',
            orderId: orderId,
            description: `Auto Escrow release for order ${orderId}: ${currentData.productTitle}`
          });

          // 2. Update Order Status
          transaction.update(orderRef, {
            status: 'completed',
            updatedAt: FieldValue.serverTimestamp(),
            autoReleased: true
          });

          // 3. Record Public Transaction
          const txRef = adminDb!.collection('transactions').doc();
          transaction.set(txRef, {
            userId: sellerId,
            senderId: 'escrow',
            receiverId: sellerId,
            orderId: orderId,
            amount: amount,
            type: 'escrow_release',
            status: 'completed',
            createdAt: FieldValue.serverTimestamp()
          });
        });
        count++;
      } catch (err) {
        console.error(`Failed to auto-release order ${orderId}:`, err);
      }
    }

    return NextResponse.json({ message: 'Successfully auto-released escrow funds', count });
  } catch (error: any) {
    console.error('Cron auto-release error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-release escrow' },
      { status: 500 }
    );
  }
}
