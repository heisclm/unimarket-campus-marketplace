import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const productRef = adminDb!.collection('products').doc(productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) {
        throw new Error('Product not found');
      }

      const productData = productSnap.data();
      if (!productData) throw new Error('Product data is empty');

      if (productData.type !== 'auction') {
        throw new Error('Product is not an auction');
      }

      if (productData.status !== 'active') {
        throw new Error(`Auction is already ${productData.status}`);
      }

      if (!productData.auctionEndTime) {
        throw new Error('Auction end time is not set');
      }

      const endTime = new Date(productData.auctionEndTime);
      if (endTime >= new Date()) {
        throw new Error('Auction has not ended yet');
      }

      // End the auction
      transaction.update(productRef, {
        status: 'ended',
        updatedAt: FieldValue.serverTimestamp()
      });

      return { success: true, message: 'Auction ended successfully' };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('End auction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to end auction' },
      { status: 400 }
    );
  }
}
