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
    const { withdrawalId, reason } = await req.json();
    if (!withdrawalId || !reason) {
      return NextResponse.json({ error: 'Withdrawal ID and reason are required' }, { status: 400 });
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
        throw new Error(`Cannot reject withdrawal with status: ${withdrawalData.status}`);
      }

      // 1. Refund the user's wallet securely with Ledger
      await updateWalletWithLedger(transaction, {
        userId: withdrawalData.userId,
        amount: withdrawalData.amount,
        type: 'refund',
        description: `Withdrawal Rejected: ${reason}`
      });

      // 2. Update Withdrawal Status
      transaction.update(withdrawalRef, {
        status: 'rejected',
        rejectReason: reason,
        updatedAt: FieldValue.serverTimestamp()
      });

      // 3. Record Refund Transaction
      const txRef = adminDb!.collection('transactions').doc();
      transaction.set(txRef, {
        userId: withdrawalData.userId,
        amount: withdrawalData.amount,
        type: 'refund',
        status: 'completed',
        description: `Withdrawal Rejected: ${reason}`,
        createdAt: FieldValue.serverTimestamp()
      });

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Withdrawal rejection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reject withdrawal' },
      { status: 400 }
    );
  }
}
