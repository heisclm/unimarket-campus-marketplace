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

    const { productId, duration, cost, currency } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Default values for backwards compatibility (e.g. students)
    const promotionCost = cost || 50;
    const promotionDuration = duration || 7;
    const paymentCurrency = currency || 'cash';

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) throw new Error('User not found');
      
      const userData = userSnap.data()!;
      
      if (paymentCurrency === 'coins') {
        if ((userData.coins || 0) < promotionCost) {
          throw new Error(`Insufficient coins. Promotion costs ${promotionCost} coins.`);
        }
        // Deduct coins from user
        transaction.update(userRef, {
          coins: FieldValue.increment(-promotionCost),
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        if ((userData.walletBalance || 0) < promotionCost) {
          throw new Error(`Insufficient wallet balance. Promotion costs GH₵${promotionCost.toFixed(2)}.`);
        }
        // Deduct via ledger
        await updateWalletWithLedger(transaction, {
          userId,
          amount: -promotionCost,
          type: 'ad_payment',
          description: `Promoted Product: ${productId}`
        });

        // Record Public Transaction for wallet
        const txRef = adminDb.collection('transactions').doc();
        transaction.set(txRef, {
          userId,
          amount: promotionCost,
          type: 'ad_payment',
          status: 'completed',
          description: `Promoted Product: ${productId}`,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      const productRef = adminDb.collection('products').doc(productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) throw new Error('Product not found');
      if (productSnap.data()?.sellerId !== userId) throw new Error('Not your product');

      // Update product with isSponsored and duration
      const sponsoredUntil = new Date();
      sponsoredUntil.setDate(sponsoredUntil.getDate() + promotionDuration);

      transaction.update(productRef, {
        isSponsored: true,
        sponsoredAt: FieldValue.serverTimestamp(),
        sponsoredUntil: sponsoredUntil
      });
      
      // Update platform revenue ledger
      const platformRef = adminDb.collection('platform').doc('stats');
      if (paymentCurrency === 'coins') {
        transaction.set(platformRef, {
          totalPromotionCoinsSpent: FieldValue.increment(promotionCost)
        }, { merge: true });
      } else {
        transaction.set(platformRef, {
          totalPromotionRevenue: FieldValue.increment(promotionCost)
        }, { merge: true });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Promotion error:', error);
    return NextResponse.json({ error: error.message || 'Failed to promote product' }, { status: 500 });
  }
}
