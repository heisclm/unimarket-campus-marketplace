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
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const buyerId = decodedToken.uid;

    // 2. Parse Request Body
    const { items, deliveryMethod } = await req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 3. Execute Secure Transaction
    const result = await adminDb.runTransaction(async (transaction) => {
      // Fetch all products to verify prices and availability
      const productRefs = items.map(item => adminDb!.collection('products').doc(item.id));
      const productSnaps = await transaction.getAll(...productRefs);

      let subtotal = 0;
      const validItems = [];

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i];
        if (!snap.exists) {
          throw new Error(`Product ${items[i].title} not found`);
        }
        const data = snap.data();
        if (!data) throw new Error(`Product ${items[i].title} data is empty`);
        if (data.status !== 'active') {
          // Allow checkout for ended auctions if the buyer is the winner
          if (data.type === 'auction' && data.status === 'ended') {
            // Verify the buyer is the winner
            const bidsRef = adminDb!.collection('bids')
              .where('auctionId', '==', snap.id)
              .orderBy('amount', 'desc')
              .limit(1);
            const bidsSnap = await transaction.get(bidsRef);
            
            if (bidsSnap.empty || bidsSnap.docs[0].data().bidderId !== buyerId) {
              throw new Error(`You are not the winner of the auction for ${data.title}`);
            }
            
            // Override price with the winning bid amount
            data.price = bidsSnap.docs[0].data().amount;
          } else {
            throw new Error(`Product ${data.title} is no longer available`);
          }
        }
        if (data.sellerId === buyerId) {
          throw new Error(`You cannot buy your own product: ${data.title}`);
        }

        subtotal += data.price;
        validItems.push({
          id: snap.id,
          title: data.title,
          price: data.price,
          sellerId: data.sellerId,
          ref: snap.ref
        });
      }

      const platformFee = subtotal * 0.02;
      const deliveryFee = deliveryMethod === 'delivery' ? 2.00 : 0;
      const totalAmount = subtotal + platformFee + deliveryFee;

      // 1. Deduct Total from Buyer Wallet Securely with Ledger
      await updateWalletWithLedger(transaction, {
        userId: buyerId,
        amount: -totalAmount,
        type: 'escrow_hold',
        description: `Cart checkout (${validItems.length} items) + fees`
      });

      const orderIds = [];

      // 2. Create Orders and Update Products
      for (const item of validItems) {
        const orderRef = adminDb!.collection('orders').doc();
        orderIds.push(orderRef.id);

        transaction.set(orderRef, {
          buyerId,
          sellerId: item.sellerId,
          productId: item.id,
          productTitle: item.title,
          amount: item.price,
          status: 'escrow_held',
          deliveryMethod,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        transaction.update(item.ref, {
          status: 'sold',
          updatedAt: FieldValue.serverTimestamp()
        });

        // Create Chat
        const chatRef = adminDb!.collection('chats').doc();
        transaction.set(chatRef, {
          participants: [buyerId, item.sellerId],
          buyerId,
          sellerId: item.sellerId,
          orderId: orderRef.id,
          createdAt: FieldValue.serverTimestamp(),
          lastMessage: 'Order placed. Start chatting with the seller!',
          lastMessageAt: FieldValue.serverTimestamp()
        });
      }

      // 3. Record Public Transaction for Fees
      if (platformFee + deliveryFee > 0) {
        const feeTxRef = adminDb!.collection('transactions').doc();
        transaction.set(feeTxRef, {
          userId: buyerId,
          senderId: buyerId,
          receiverId: 'platform',
          amount: platformFee + deliveryFee,
          type: 'withdrawal',
          status: 'completed',
          description: 'Platform & Delivery Fees',
          createdAt: FieldValue.serverTimestamp()
        });
      }

      // Update user total spent
      const userRef = adminDb!.collection('users').doc(buyerId);
      transaction.update(userRef, {
        totalSpent: FieldValue.increment(platformFee + deliveryFee)
      });

      return { success: true, orderIds };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process checkout' },
      { status: 400 }
    );
  }
}
