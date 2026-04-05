import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateWalletWithLedger } from '@/lib/ledger-admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Authentication & Admin Role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const adminId = decodedToken.uid;

    const adminRef = adminDb.collection('users').doc(adminId);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 2. Parse Request Body
    const { orderId, action, adminNote } = await req.json();
    if (!orderId || !action || !adminNote) {
      return NextResponse.json({ error: 'Order ID, action, and admin note are required' }, { status: 400 });
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

      if (orderData.status !== 'disputed' && orderData.status !== 'escrow_held') {
        throw new Error('Order cannot be resolved in current state');
      }

      const amount = orderData.amount;

      if (action === 'release') {
        // Release to Seller
        await updateWalletWithLedger(transaction, {
          userId: orderData.sellerId,
          amount: amount,
          type: 'escrow_release',
          orderId: orderId,
          description: `Admin Release: ${adminNote}`
        });

        transaction.update(orderRef, {
          status: 'completed',
          adminNote: `Admin Release: ${adminNote}`,
          updatedAt: FieldValue.serverTimestamp()
        });

        // Record Public Transaction
        const txRef = adminDb.collection('transactions').doc();
        transaction.set(txRef, {
          userId: orderData.sellerId,
          senderId: 'escrow',
          receiverId: orderData.sellerId,
          orderId: orderId,
          amount: amount,
          type: 'escrow_release',
          status: 'completed',
          createdAt: FieldValue.serverTimestamp()
        });
      } else if (action === 'refund') {
        // Refund to Buyer
        await updateWalletWithLedger(transaction, {
          userId: orderData.buyerId,
          amount: amount,
          type: 'escrow_refund',
          orderId: orderId,
          description: `Admin Refund: ${adminNote}`
        });

        transaction.update(orderRef, {
          status: 'refunded',
          adminNote: `Admin Refund: ${adminNote}`,
          updatedAt: FieldValue.serverTimestamp()
        });

        // Record Public Transaction
        const txRef = adminDb.collection('transactions').doc();
        transaction.set(txRef, {
          userId: orderData.buyerId,
          senderId: 'escrow',
          receiverId: orderData.buyerId,
          orderId: orderId,
          amount: amount,
          type: 'escrow_refund',
          status: 'completed',
          createdAt: FieldValue.serverTimestamp()
        });

        // Put product back to active
        const productRef = adminDb.collection('products').doc(orderData.productId);
        transaction.update(productRef, {
          status: 'active',
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        throw new Error('Invalid action');
      }

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Admin escrow resolution error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resolve escrow' },
      { status: 400 }
    );
  }
}
