import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateWalletWithLedger } from '@/lib/ledger-admin';

export async function POST(req: NextRequest) {
  try {
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

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const orderRef = adminDb.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error('Order not found');
      }

      const orderData = orderSnap.data();
      if (!orderData) throw new Error('Order data is empty');

      if (orderData.buyerId !== buyerId) {
        throw new Error('Unauthorized: Only the buyer can reject the item');
      }

      if (orderData.status !== 'escrow_held' && orderData.status !== 'delivered') {
        throw new Error('Order must be in escrow_held or delivered state to reject');
      }

      let rejectionCount = orderData.rejectionCount || 0;
      rejectionCount += 1;

      // Handle the 3rd Strike (Auto-Refund)
      if (rejectionCount >= 3) {
        // Refund Buyer with gross amount + delivery if any.
        // During checkout, what was the total held?
        // Let's accurately refund what was taken. 
        // We know buyerTotalAmount = item.price + delivery.
        // Wait, checkout handles it as `buyerTotalAmount = subtotal + deliveryFee` subtracted linearly.
        // For individual items, let's just refund the `amount` (gross) since delivery is tricky if 1 order.
        // Actually, just refunding the gross amount is fine. To handle delivery perfectly we should include it if applicable.
        const deliveryRefund = orderData.deliveryMethod === 'delivery' ? 2.00 : 0;
        const totalRefund = orderData.amount + deliveryRefund;

        await updateWalletWithLedger(transaction, {
          userId: buyerId,
          amount: totalRefund,
          type: 'escrow_refund',
          orderId: orderId,
          description: `Auto-refund (3rd rejection) for order ${orderId}: ${orderData.productTitle}`
        });

        transaction.update(orderRef, {
          status: 'cancelled_refunded',
          rejectionCount: rejectionCount,
          updatedAt: FieldValue.serverTimestamp()
        });

        // Make product available again
        const productRef = adminDb.collection('products').doc(orderData.productId);
        transaction.update(productRef, {
          status: 'available',
          updatedAt: FieldValue.serverTimestamp()
        });

        // Notify Buyer
        const buyerNotifRef = adminDb.collection('notifications').doc();
        transaction.set(buyerNotifRef, {
          userId: buyerId,
          title: 'Auto-Refund Issued',
          message: `Your order for ${orderData.productTitle} hit the 3-strike rejection limit. GH₵${totalRefund.toFixed(2)} has been refunded to your wallet.`,
          type: 'wallet',
          link: '/profile',
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });

        // Notify Seller
        const sellerNotifRef = adminDb.collection('notifications').doc();
        transaction.set(sellerNotifRef, {
          userId: orderData.sellerId,
          title: 'Order Cancelled (3 Strikes) ⚠️',
          message: `The order for ${orderData.productTitle} was rejected 3 times and has been automatically cancelled. Funds were refunded to the buyer.`,
          type: 'alert',
          link: '/vendor',
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });

        return { success: true, autoCancelled: true };
      } else {
        // Less than 3 rejections, enter pending seller decision
        transaction.update(orderRef, {
          status: 'rejected_pending_seller',
          rejectionCount: rejectionCount,
          updatedAt: FieldValue.serverTimestamp()
        });

        // Notify the Seller about the Rejection
        const notifRef = adminDb.collection('notifications').doc();
        transaction.set(notifRef, {
          userId: orderData.sellerId,
          title: 'Order Rejected 🛑',
          message: `The buyer rejected the delivery of ${orderData.productTitle}. Action is required in your dashboard immediately.`,
          type: 'alert',
          link: '/vendor',
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });

        return { success: true, autoCancelled: false, rejectionCount };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Escrow reject error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reject escrow' },
      { status: 400 }
    );
  }
}
