import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Orders stuck in 'delivered' for more than 48 hours
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - FORTY_EIGHT_HOURS);

    const deliveredOrdersSnap = await adminDb.collection('orders')
      .where('status', '==', 'delivered')
      .where('updatedAt', '<=', cutoffTime)
      .get();

    if (deliveredOrdersSnap.empty) {
      return NextResponse.json({ message: 'No orders to auto-release', count: 0 });
    }

    let count = 0;

    // Process each order in a transaction to ensure ledger integrity
    for (const doc of deliveredOrdersSnap.docs) {
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
          const netAmount = currentData.netAmount || amount;

          // --- ALL READS ---
          const sellerRef = adminDb!.collection('users').doc(sellerId);
          const sellerSnap = await transaction.get(sellerRef);
          
          let prevEarned = 0;
          let userData: any = {};
          let previousBalance = 0;
          
          if (sellerSnap.exists) {
            userData = sellerSnap.data() || {};
            prevEarned = userData.totalEarned || 0;
            previousBalance = userData.walletBalance || 0;
          }
          
          const newEarned = prevEarned + netAmount;
          
          let bonusCoins = 0;
          
          // Base Cashback: 2 coins for every GH₵ earned
          bonusCoins += Math.floor(netAmount * 2);
          
          // Velocity milestones
          if (prevEarned < 500 && newEarned >= 500) {
            bonusCoins += 1000;
          } else if (prevEarned < 2000 && newEarned >= 2000) {
            bonusCoins += 3000;
          }

          const newBalance = previousBalance + netAmount;

          // --- ALL WRITES ---
          // 1. Update Seller Wallet and totalEarned
          transaction.update(sellerRef, {
            walletBalance: newBalance,
            totalEarned: FieldValue.increment(netAmount),
            coins: FieldValue.increment(bonusCoins),
            updatedAt: FieldValue.serverTimestamp()
          });

          // 2. Ledger Entry for Escrow Release
          const escrowLedgerRef = adminDb!.collection('wallet_ledger').doc();
          transaction.set(escrowLedgerRef, {
            userId: sellerId,
            amount: netAmount,
            type: 'escrow_release',
            orderId: orderId,
            previousBalance: previousBalance,
            newBalance: previousBalance + netAmount,
            description: `Auto Escrow release for order ${orderId}: ${currentData.productTitle}`,
            createdAt: FieldValue.serverTimestamp()
          });

          // 3. Update Order Status
          transaction.update(orderRef, {
            status: 'completed',
            updatedAt: FieldValue.serverTimestamp(),
            autoReleased: true
          });

          // 4. Notify the Seller that their funds cleared
          const notifRef = adminDb!.collection('notifications').doc();
          transaction.set(notifRef, {
            userId: sellerId,
            title: 'Escrow Auto-Released! 💰',
            message: `The buyer did not confirm receipt in 48 hours. GH₵${netAmount.toFixed(2)} for ${currentData.productTitle} has been automatically added to your wallet!`,
            type: 'wallet',
            link: '/dashboard',
            read: false,
            createdAt: FieldValue.serverTimestamp()
          });

          // 5. Record Public Transaction
          const txRef = adminDb!.collection('transactions').doc();
          transaction.set(txRef, {
            userId: sellerId,
            senderId: 'escrow',
            receiverId: sellerId,
            orderId: orderId,
            amount: netAmount,
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
