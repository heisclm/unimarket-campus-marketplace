import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    console.log("Looking for stranded pending withdrawal transactions...");
    
    const pendingTxsSnapshot = await adminDb.collection('transactions')
      .where('type', '==', 'withdrawal')
      .where('status', '==', 'pending')
      .get();

    if (pendingTxsSnapshot.empty) {
      console.log("No pending withdrawal transactions found.");
      return NextResponse.json({ success: true, fixedCount: 0, message: "No pending found" });
    }

    console.log(`Found ${pendingTxsSnapshot.docs.length} pending withdrawal transactions.`);

    let fixedCount = 0;

    for (const txDoc of pendingTxsSnapshot.docs) {
      const txData = txDoc.data();
      
      const approvedWithdrawalsSnapshot = await adminDb.collection('withdrawals')
        .where('userId', '==', txData.userId)
        .where('amount', '==', txData.amount)
        .where('status', '==', 'approved')
        .get();

      if (!approvedWithdrawalsSnapshot.empty) {
        await txDoc.ref.update({
          status: 'completed',
          updatedAt: FieldValue.serverTimestamp()
        });
        fixedCount++;
      }
    }

    return NextResponse.json({ success: true, fixedCount });
  } catch (error: any) {
    console.error('Withdrawal fix error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fix withdrawal' },
      { status: 400 }
    );
  }
}
