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
    if (!adminAuth) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const buyerId = decodedToken.uid;

    // 2. Parse Request Body
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // 3. Execute Secure Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      const orderRef = adminDb.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error('Order not found');
      }

      const orderData = orderSnap.data();
      if (!orderData) throw new Error('Order data is empty');

      // Security Check: Only the buyer can confirm receipt
      if (orderData.buyerId !== buyerId) {
        throw new Error('Unauthorized: Only the buyer can confirm receipt');
      }

      // Security Check: Order must be in a state that allows release
      if (orderData.status !== 'delivered' && orderData.status !== 'escrow_held') {
        throw new Error('Order must be delivered or held before confirmation');
      }

      const sellerId = orderData.sellerId;
      const amount = orderData.amount;
      const netAmount = orderData.netAmount || amount;

      // 1. Update Seller Wallet Securely with Ledger
      await updateWalletWithLedger(transaction, {
        userId: sellerId,
        amount: netAmount,
        type: 'escrow_release',
        orderId: orderId,
        description: `Escrow release for order ${orderId}: ${orderData.productTitle}`
      });

      // 2. Update Order Status
      transaction.update(orderRef, {
        status: 'completed',
        updatedAt: FieldValue.serverTimestamp()
      });

      // Notify the Seller that their funds cleared
      const notifRef = adminDb.collection('notifications').doc();
      transaction.set(notifRef, {
        userId: sellerId,
        title: 'Escrow Released! 💰',
        message: `The buyer accepted ${orderData.productTitle}. GH₵${netAmount.toFixed(2)} has been added to your wallet!`,
        type: 'wallet',
        link: '/profile',
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });

      // 3. Record Public Transaction (for history)
      const txRef = adminDb.collection('transactions').doc();
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

      // 4. Update the seller's totalEarned and give Vendor Bonus
      const sellerRef = adminDb.collection('users').doc(sellerId);
      const sellerSnap = await transaction.get(sellerRef);
      
      let prevEarned = 0;
      if (sellerSnap.exists) {
        prevEarned = sellerSnap.data()?.totalEarned || 0;
      }
      const newEarned = prevEarned + netAmount;
      
      transaction.update(sellerRef, {
        totalEarned: FieldValue.increment(netAmount)
      });
      
      let bonus = 0;
      let bonusReason = '';
      
      // Base Cashback: 1% cashback on every sale as a vendor bonus
      bonus += Number((netAmount * 0.01).toFixed(2));
      bonusReason = '1% Vendor Sales Bonus';
      
      // Velocity milestones
      if (prevEarned < 500 && newEarned >= 500) {
        bonus += 50;
        bonusReason += ' + 500 Sales Milestone';
      } else if (prevEarned < 2000 && newEarned >= 2000) {
        bonus += 150;
        bonusReason += ' + 2000 Sales Milestone';
      }
      
      if (bonus > 0 && sellerSnap.exists) {
        await updateWalletWithLedger(transaction, {
          userId: sellerId,
          amount: bonus,
          type: 'vendor_bonus',
          orderId: orderId,
          description: `Vendor Bonus: ${bonusReason}`
        });
        
        // Notify them
        const bonusNotifRef = adminDb.collection('notifications').doc();
        transaction.set(bonusNotifRef, {
          userId: sellerId,
          title: 'Vendor Bonus Earned! 🎉',
          message: `You earned a vendor bonus of GH₵${bonus.toFixed(2)} for: ${bonusReason}! Keep up the great work!`,
          type: 'wallet',
          link: '/profile',
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Escrow release error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to release escrow' },
      { status: 400 }
    );
  }
}
