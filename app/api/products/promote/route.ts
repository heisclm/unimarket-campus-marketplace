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
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const promotionCost = 50.00;

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) throw new Error('User not found');
      
      const userData = userSnap.data()!;
      if ((userData.walletBalance || 0) < promotionCost) {
        throw new Error(`Insufficient wallet balance. Promotion costs GH₵${promotionCost.toFixed(2)}.`);
      }

      const productRef = adminDb.collection('products').doc(productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) throw new Error('Product not found');
      if (productSnap.data()?.sellerId !== userId) throw new Error('Not your product');

      // Deduct via ledger
      await updateWalletWithLedger(transaction, {
        userId,
        amount: -promotionCost,
        type: 'withdrawal',
        description: `Promoted Product: ${productSnap.data()?.title}`
      });

      // Update product
      transaction.update(productRef, {
        isSponsored: true,
        sponsoredAt: FieldValue.serverTimestamp()
      });
      
      // Update platform revenue
      const platformRef = adminDb.collection('platform').doc('stats');
      transaction.set(platformRef, {
        totalPromotionRevenue: FieldValue.increment(promotionCost)
      }, { merge: true });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Promotion error:', error);
    return NextResponse.json({ error: error.message || 'Failed to promote product' }, { status: 500 });
  }
}
