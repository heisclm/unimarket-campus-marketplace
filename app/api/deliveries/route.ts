import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 1. Fetch available deliveries (rider requested, but not yet taken)
    const availableSnap = await adminDb.collection('orders')
      .where('status', '==', 'escrow_held')
      .where('deliveryPreference', '==', 'rider')
      .get();
      
    // Filter out orders that already have a rider or belong to the current user
    const availableDeliveries = availableSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((order: any) => !order.riderId && order.buyerId !== uid && order.sellerId !== uid)
      .map((order: any) => {
        return order;
      });

    // 2. Fetch my accepted deliveries
    const mySnap = await adminDb.collection('orders')
      .where('riderId', '==', uid)
      .get();

    const myDeliveries = mySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ available: availableDeliveries, myDeliveries });
  } catch (error: any) {
    console.error("API Error fetching deliveries:", error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
