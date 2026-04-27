import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { processAuctionEnd } from '@/lib/auction-end';

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

    for (const doc of expiredAuctionsSnap.docs) {
      const productId = doc.id;
      try {
        await processAuctionEnd(productId);
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
