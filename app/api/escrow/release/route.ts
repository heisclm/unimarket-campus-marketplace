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

      // 1. Update Seller Wallet Securely with Ledger
      await updateWalletWithLedger(transaction, {
        userId: sellerId,
        amount: amount,
        type: 'escrow_release',
        orderId: orderId,
        description: `Escrow release for order ${orderId}: ${orderData.productTitle}`
      });

      // 2. Update Order Status
      transaction.update(orderRef, {
        status: 'completed',
        updatedAt: FieldValue.serverTimestamp()
      });

      // 3. Record Public Transaction (for history)
      const txRef = adminDb.collection('transactions').doc();
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
