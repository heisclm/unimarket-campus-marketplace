import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
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

    const { orderId, buyerId } = await req.json();

    if (!orderId || !buyerId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};
    
    if (userData.role === 'vendor') {
      return NextResponse.json({ error: 'Vendors cannot accept deliveries.' }, { status: 403 });
    }

    if (!userData.isVerified) {
       return NextResponse.json({ error: 'Must be verified student to deliver' }, { status: 403 });
    }

    const orderRef = adminDb.collection('orders').doc(orderId);
    
    const chatId = await adminDb.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
            throw new Error('Order not found');
        }
        
        const orderData = orderSnap.data()!;
        if (orderData.riderId) { 
            throw new Error('Delivery already claimed');
        }
        
        transaction.update(orderRef, {
            riderId: uid,
            deliveryStatus: 'accepted'
        });
        
        const generatedChatId = `delivery_${orderId}_${uid}`;
        const chatRef = adminDb.collection('chats').doc(generatedChatId);
        
        transaction.set(chatRef, {
            participants: [uid, buyerId],
            isGroup: false,
            isDeliveryChat: true,
            orderId: orderId,
            createdAt: FieldValue.serverTimestamp(),
            lastMessage: "I offered to deliver your item! Let's negotiate the fee and my ETA.",
            lastMessageAt: FieldValue.serverTimestamp(),
            participantDetails: {
              [uid]: { name: userData.displayName || 'Rider', role: userData.role || 'student', photoURL: userData.photoURL || '' },
              [buyerId]: { name: 'Buyer', role: 'student', photoURL: '' }
            },
            [`unreadCount.${buyerId}`]: FieldValue.increment(1)
        }, { merge: true });
        
        const initMsgRef = chatRef.collection('messages').doc('init');
        transaction.set(initMsgRef, {
             chatId: generatedChatId,
             senderId: uid,
             text: "Hi! I saw your request for a Campus Rider. I can deliver this. What's your offer for the delivery fee?",
             status: 'sent',
             createdAt: FieldValue.serverTimestamp()
        });
        
        return generatedChatId;
    });

    return NextResponse.json({ success: true, chatId });
  } catch (error: any) {
    console.error("API Error accepting delivery:", error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
