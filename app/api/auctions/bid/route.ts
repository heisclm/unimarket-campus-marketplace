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
    const bidderId = decodedToken.uid;

    // 2. Parse Request Body
    const { productId, amount } = await req.json();
    if (!productId || !amount || isNaN(amount)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    // 3. Execute Secure Bidding Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      const productRef = adminDb.collection('products').doc(productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) {
        throw new Error('Auction product not found');
      }

      const productData = productSnap.data();
      if (!productData) throw new Error('Product data is empty');

      // Validate Auction Status
      if (productData.type !== 'auction') {
        throw new Error('This product is not an auction');
      }
      if (productData.status !== 'active') {
        throw new Error('This auction is no longer active');
      }

      // Validate Auction Time (Server Side)
      const now = new Date();
      if (productData.auctionEndTime) {
        const endTime = new Date(productData.auctionEndTime);
        if (now > endTime) {
          throw new Error('This auction has already ended');
        }
      }

      // Prevent seller from bidding on their own item
      if (productData.sellerId === bidderId) {
        throw new Error('You cannot bid on your own auction');
      }

      // Get Current Highest Bid
      // Proper query: auctionId == productId ORDER BY amount DESC
      // Requires composite index: auctionId (ASC), amount (DESC)
      const bidsQuery = adminDb.collection('bids')
        .where('auctionId', '==', productId)
        .orderBy('amount', 'desc')
        .limit(1);
      
      const bidsSnapshot = await transaction.get(bidsQuery);
      let currentHighestBid = productData.price || 0;
      let previousBidderId = null;

      if (!bidsSnapshot.empty) {
        const topBid = bidsSnapshot.docs[0].data();
        currentHighestBid = topBid.amount;
        previousBidderId = topBid.bidderId;
      }


      // Validate Bid Amount
      if (amount <= currentHighestBid) {
        throw new Error(`Bid must be higher than the current highest bid (GH₵${currentHighestBid.toFixed(2)})`);
      }

      // 4. Place the Bid
      const bidRef = adminDb.collection('bids').doc();
      transaction.set(bidRef, {
        auctionId: productId,
        bidderId: bidderId,
        amount: amount,
        createdAt: FieldValue.serverTimestamp()
      });

      // 5. Notify Previous Bidder (if any)
      if (previousBidderId && previousBidderId !== bidderId) {
        const notifRef = adminDb.collection('notifications').doc();
        transaction.set(notifRef, {
          userId: previousBidderId,
          title: 'Outbid!',
          message: `You have been outbid on "${productData.title}". New bid: GH₵${amount.toFixed(2)}`,
          type: 'bid',
          read: false,
          link: `/products/${productId}`,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      return { success: true, bidId: bidRef.id };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Bidding error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place bid' },
      { status: 400 }
    );
  }
}
