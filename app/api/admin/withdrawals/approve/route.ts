import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Check if user is admin
    const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    // 2. Parse Request Body
    const { withdrawalId } = await req.json();
    if (!withdrawalId) {
      return NextResponse.json({ error: 'Withdrawal ID is required' }, { status: 400 });
    }

    // 3. Execute Secure Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      const withdrawalRef = adminDb!.collection('withdrawals').doc(withdrawalId);
      const withdrawalSnap = await transaction.get(withdrawalRef);

      if (!withdrawalSnap.exists) {
        throw new Error('Withdrawal not found');
      }

      const withdrawalData = withdrawalSnap.data();
      if (!withdrawalData) throw new Error('Withdrawal data is empty');

      if (withdrawalData.status !== 'pending') {
        throw new Error(`Cannot approve withdrawal with status: ${withdrawalData.status}`);
      }

      // 1. Update Withdrawal Status
      transaction.update(withdrawalRef, {
        status: 'approved',
        updatedAt: FieldValue.serverTimestamp()
      });

      // 2. Find and update the associated pending transaction for the user
      // Since transactions might not have withdrawalId stored historically, we search by userId and amount and pending
      let txRefToUpdate = null;
      
      const pendingTxsSnapshot = await adminDb!.collection('transactions')
        .where('userId', '==', withdrawalData.userId)
        .where('type', '==', 'withdrawal')
        .where('status', '==', 'pending')
        .where('amount', '==', withdrawalData.amount)
        .limit(1)
        .get();

      if (!pendingTxsSnapshot.empty) {
        txRefToUpdate = pendingTxsSnapshot.docs[0].ref;
      } else {
        // Fallback: Just get any pending withdrawal transaction for the user
        const anyPendingTxSnapshot = await adminDb!.collection('transactions')
          .where('userId', '==', withdrawalData.userId)
          .where('type', '==', 'withdrawal')
          .where('status', '==', 'pending')
          .limit(1)
          .get();
        if (!anyPendingTxSnapshot.empty) {
          txRefToUpdate = anyPendingTxSnapshot.docs[0].ref;
        }
      }

      if (txRefToUpdate) {
        transaction.update(txRefToUpdate, {
          status: 'completed',
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        console.warn(`No pending transaction found to approve for withdrawal ${withdrawalId}`);
      }

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Withdrawal approval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve withdrawal' },
      { status: 400 }
    );
  }
}
