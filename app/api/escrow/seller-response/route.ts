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
    const sellerId = decodedToken.uid;

    const { orderId, action } = await req.json(); // action must be 'cancel' or 'resend'
    if (!orderId || !action) {
      return NextResponse.json({ error: 'Order ID and action are required' }, { status: 400 });
    }

    if (action !== 'cancel' && action !== 'resend') {
      return NextResponse.json({ error: 'Invalid action. Must be cancel or resend' }, { status: 400 });
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const orderRef = adminDb.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error('Order not found');
      }

      const orderData = orderSnap.data();
      if (!orderData) throw new Error('Order data is empty');

      if (orderData.sellerId !== sellerId) {
        throw new Error('Unauthorized: Only the seller can respond');
      }

      if (orderData.status !== 'rejected_pending_seller') {
        throw new Error('Order is not in a state waiting for seller response');
      }

      if (action === 'cancel') {
        // Seller chose to cancel and refund buyer
        const deliveryRefund = orderData.deliveryMethod === 'delivery' ? 2.00 : 0;
        const totalRefund = orderData.amount + deliveryRefund;

        await updateWalletWithLedger(transaction, {
          userId: orderData.buyerId,
          amount: totalRefund,
          type: 'escrow_refund',
          orderId: orderId,
          description: `Seller cancelled after rejection for order ${orderId}: ${orderData.productTitle}`
        });

        transaction.update(orderRef, {
          status: 'cancelled_refunded',
          updatedAt: FieldValue.serverTimestamp()
        });

        // Make product available again
        const productRef = adminDb.collection('products').doc(orderData.productId);
        transaction.update(productRef, {
          status: 'available',
          updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true, status: 'cancelled_refunded' };
      } else if (action === 'resend') {
        // Seller chose to resend
        transaction.update(orderRef, {
          status: 'escrow_held', // Goes back to holding / out for delivery
          updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true, status: 'escrow_held' };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Escrow seller response error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process seller response' },
      { status: 400 }
    );
  }
}
