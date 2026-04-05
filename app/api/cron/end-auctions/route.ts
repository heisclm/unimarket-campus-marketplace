import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const now = new Date().toISOString();

    // Find all active auctions that have passed their end time
    const expiredAuctionsSnap = await adminDb.collection('products')
      .where('type', '==', 'auction')
      .where('status', '==', 'active')
      .where('auctionEndTime', '<=', now)
      .get();

    if (expiredAuctionsSnap.empty) {
      return NextResponse.json({ message: 'No expired auctions found', count: 0 });
    }

    let count = 0;

    // Process each auction in a transaction to ensure atomicity
    for (const doc of expiredAuctionsSnap.docs) {
      const productId = doc.id;
      
      try {
        await adminDb.runTransaction(async (transaction) => {
          const productRef = adminDb!.collection('products').doc(productId);
          const productSnap = await transaction.get(productRef);
          
          if (!productSnap.exists) return;
          const productData = productSnap.data();
          
          if (productData?.status !== 'active') return; // Already processed

          // Get the highest bid
          const bidsQuery = adminDb!.collection('bids')
            .where('auctionId', '==', productId)
            .orderBy('amount', 'desc')
            .limit(1);
            
          const bidsSnapshot = await transaction.get(bidsQuery);
          
          let winnerId = null;
          let finalPrice = productData.price || 0;

          if (!bidsSnapshot.empty) {
            const topBid = bidsSnapshot.docs[0].data();
            winnerId = topBid.bidderId;
            finalPrice = topBid.amount;
          }

          // Update product status
          transaction.update(productRef, {
            status: 'ended',
            winnerId: winnerId,
            finalPrice: finalPrice,
            updatedAt: FieldValue.serverTimestamp()
          });

          // Notify winner if there is one
          if (winnerId) {
            const notifRef = adminDb!.collection('notifications').doc();
            transaction.set(notifRef, {
              userId: winnerId,
              title: 'Auction Won!',
              message: `Congratulations! You won the auction for "${productData.title}" with a bid of GH₵${finalPrice.toFixed(2)}. Please proceed to checkout.`,
              type: 'auction_won',
              read: false,
              link: `/checkout?product=${productId}`,
              createdAt: FieldValue.serverTimestamp()
            });
          }
        });
        count++;
      } catch (err) {
        console.error(`Failed to end auction ${productId}:`, err);
      }
    }

    return NextResponse.json({ message: 'Successfully ended expired auctions', count });
  } catch (error: any) {
    console.error('Cron end-auctions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to end auctions' },
      { status: 500 }
    );
  }
}
