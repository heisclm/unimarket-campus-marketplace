import { NextRequest, NextResponse } from 'next/server';
import { processAuctionEnd } from '@/lib/auction-end';

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const result = await processAuctionEnd(productId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('End auction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to end auction' },
      { status: 400 }
    );
  }
}
