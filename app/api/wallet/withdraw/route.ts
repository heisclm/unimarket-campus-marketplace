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
    const userId = decodedToken.uid;

    // 2. Parse Request Body
    const { amount, details } = await req.json();
    if (!amount || isNaN(amount) || amount <= 0 || !details) {
      return NextResponse.json({ error: 'Valid amount and withdrawal details are required' }, { status: 400 });
    }

    // 3. Execute Secure Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Deduct from Wallet with Ledger
      await updateWalletWithLedger(transaction, {
        userId,
        amount: -amount,
        type: 'withdrawal',
        description: `Withdrawal Request: ${details}`
      });

      // 2. Create Withdrawal Record
      const withdrawalRef = adminDb.collection('withdrawals').doc();
      transaction.set(withdrawalRef, {
        userId,
        amount,
        details,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // 3. Record Public Transaction
      const txRef = adminDb.collection('transactions').doc();
      transaction.set(txRef, {
        userId,
        amount,
        type: 'withdrawal',
        status: 'pending',
        description: 'Withdrawal Request',
        createdAt: FieldValue.serverTimestamp()
      });

      return { success: true, withdrawalId: withdrawalRef.id };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process withdrawal' },
      { status: 400 }
    );
  }
}
