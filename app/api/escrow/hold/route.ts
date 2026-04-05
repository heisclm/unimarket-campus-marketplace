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
    if (!adminAuth) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const buyerId = decodedToken.uid;

    // 2. Parse Request Body
    const { productId, deliveryMethod } = await req.json();
    if (!productId || !deliveryMethod) {
      return NextResponse.json({ error: 'Product ID and delivery method are required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // 3. Execute Secure Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      const productRef = adminDb.collection('products').doc(productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists) {
        throw new Error('Product not found');
      }

      const productData = productSnap.data();
      if (!productData) throw new Error('Product data is empty');

      if (productData.status !== 'active') {
        throw new Error('Product is no longer available');
      }

      const sellerId = productData.sellerId;
      const amount = productData.price;

      if (buyerId === sellerId) {
        throw new Error('You cannot buy your own product');
      }

      // 1. Deduct from Buyer Wallet Securely with Ledger
      await updateWalletWithLedger(transaction, {
        userId: buyerId,
        amount: -amount,
        type: 'escrow_hold',
        description: `Escrow hold for product: ${productData.title}`
      });

      // 2. Create Order
      const orderRef = adminDb.collection('orders').doc();
      transaction.set(orderRef, {
        buyerId,
        sellerId,
        productId,
        productTitle: productData.title,
        amount,
        status: 'escrow_held',
        deliveryMethod,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // 3. Record Public Transaction
      const txRef = adminDb.collection('transactions').doc();
      transaction.set(txRef, {
        userId: buyerId,
        senderId: buyerId,
        receiverId: 'escrow',
        orderId: orderRef.id,
        amount,
        type: 'escrow_hold',
        status: 'completed',
        createdAt: FieldValue.serverTimestamp()
      });

      // 4. Update Product Status
      transaction.update(productRef, {
        status: 'sold',
        updatedAt: FieldValue.serverTimestamp()
      });

      // 5. Create Chat
      const chatRef = adminDb.collection('chats').doc();
      transaction.set(chatRef, {
        participants: [buyerId, sellerId],
        buyerId,
        sellerId,
        orderId: orderRef.id,
        createdAt: FieldValue.serverTimestamp(),
        lastMessage: 'Order placed. Start chatting with the seller!',
        lastMessageAt: FieldValue.serverTimestamp()
      });

      return { success: true, orderId: orderRef.id };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Escrow hold error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place order' },
      { status: 400 }
    );
  }
}
