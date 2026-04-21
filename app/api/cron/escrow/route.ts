import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Protect this route by requiring a CRON_SECRET token 
// setup in platform environmental variables.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const cronSecret = process.env.CRON_SECRET;

    // Validate if the bot is authorized
    if (cronSecret && token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Orders stuck in 'delivered' for more than 48 hours
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - FORTY_EIGHT_HOURS);

    // Note: To use an inequality filter on updatedAt, we need an index.
    // Ensure you deploy a composite index for: orders (status: ASC, updatedAt: ASC)
    const stuckOrdersSnapshot = await adminDb.collection('orders')
      .where('status', '==', 'delivered')
      .where('updatedAt', '<=', cutoffTime)
      .limit(100) // Process in batches so it does not exceed memory timeouts
      .get();

    if (stuckOrdersSnapshot.empty) {
      return NextResponse.json({ message: 'No stuck escrows found.', count: 0 }, { status: 200 });
    }

    let processedCount = 0;

    // We process each stuck escrow carefully
    for (const orderDoc of stuckOrdersSnapshot.docs) {
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;

      try {
        await adminDb.runTransaction(async (transaction) => {
          // Re-fetch within transaction specifically for atomicity
          const lockedOrderDoc = await transaction.get(orderDoc.ref);
          if (!lockedOrderDoc.exists) return;
          
          const data = lockedOrderDoc.data()!;
          if (data.status !== 'delivered') return; // State changed during processing
          
          const amount = data.amount;
          const sellerId = data.sellerId;

          const sellerRef = adminDb.collection('users').doc(sellerId);
          const sellerSnap = await transaction.get(sellerRef);
          
          let sellerBalance = 0;
          if (sellerSnap.exists) {
            sellerBalance = sellerSnap.data()?.walletBalance || 0;
          }

          // 1. Release Funds to Seller Wallet
          const platformFee = amount * 0.05; // 5% fee assumption matching rest of system
          const netAmount = amount - platformFee;

          transaction.update(sellerRef, {
            walletBalance: sellerBalance + netAmount,
            totalEarned: (sellerSnap.data()?.totalEarned || 0) + netAmount
          });

          // 2. Mark order as completely finished
          transaction.update(orderDoc.ref, {
            status: 'completed',
            updatedAt: new Date()
          });

          // 3. Mark the original transaction as completed via a reciprocal release log
          const txRef = adminDb.collection('transactions').doc();
          transaction.set(txRef, {
            userId: sellerId,
            senderId: 'escrow',
            receiverId: sellerId,
            orderId: orderId,
            amount: netAmount,
            type: 'escrow_release',
            status: 'completed',
            isAutoRelease: true, 
            createdAt: new Date(),
          });

          // 4. Create Notification for Seller
          const notificationRef = adminDb.collection('notifications').doc();
          transaction.set(notificationRef, {
            userId: sellerId,
            title: 'Escrow Auto-Released',
            message: `Funds (GH₵${netAmount.toFixed(2)}) for your order have been automatically released.`,
            type: 'system',
            read: false,
            link: `/dashboard`,
            createdAt: new Date(),
          });
        });
        
        processedCount++;
      } catch (err) {
        console.error(`Failed to process auto-release for order ${orderId}:`, err);
      }
    }

    return NextResponse.json({ 
      message: 'Escrow bot run complete', 
      processed: processedCount,
      targetCount: stuckOrdersSnapshot.size 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Escrow cron error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
