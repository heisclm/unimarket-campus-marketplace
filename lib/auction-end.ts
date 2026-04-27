import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { updateWalletWithLedger } from '@/lib/ledger-admin';

export async function processAuctionEnd(productId: string) {
  if (!adminDb) return { success: false, error: 'Database not initialized' };

  return await adminDb.runTransaction(async (transaction) => {
    const productRef = adminDb.collection('products').doc(productId);
    const productSnap = await transaction.get(productRef);

    if (!productSnap.exists) throw new Error('Product not found');
    const productData = productSnap.data();
    if (!productData) throw new Error('Product data is empty');
    if (productData.status !== 'active') return { success: false, message: 'Already ended' };

    // Find top bid
    const bidsRef = adminDb.collection('bids')
      .where('auctionId', '==', productId)
      .orderBy('amount', 'desc')
      .limit(1);
    const bidsSnap = await transaction.get(bidsRef);

    let winnerId = null;
    let finalPrice = productData.price || 0;

    if (!bidsSnap.empty) {
      const topBid = bidsSnap.docs[0].data();
      winnerId = topBid.bidderId;
      finalPrice = topBid.amount;
    }

    if (!winnerId) {
      // Nobody bid
      transaction.update(productRef, {
        status: 'ended',
        updatedAt: FieldValue.serverTimestamp()
      });
      return { success: true, message: 'Auction ended with no bids' };
    }

    // Attempt Auto-Debit
    const userRef = adminDb.collection('users').doc(winnerId);
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() || {};
    const walletBalance = userData.walletBalance || 0;

    if (walletBalance >= finalPrice) {
      // They have enough! Auto debit + Create Order!
      
      const sellerDataSnap = await transaction.get(adminDb.collection('users').doc(productData.sellerId));
      const sellerData = sellerDataSnap.data() || {};
      const isVendor = sellerData.role === 'vendor';
      const feePercentage = isVendor ? 0.05 : 0.02;
      const platformFee = finalPrice * feePercentage;
      
      // Deduct from wallet securely
      await updateWalletWithLedger(transaction, {
        userId: winnerId,
        amount: -finalPrice,
        type: 'escrow_hold',
        description: `Auto-checkout for winning auction: ${productData.title}`
      });

      // Update product Status to sold
      transaction.update(productRef, {
        status: 'sold',
        winnerId,
        finalPrice,
        quantity: 0,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Create Order
      const orderRef = adminDb.collection('orders').doc();
      transaction.set(orderRef, {
        buyerId: winnerId,
        sellerId: productData.sellerId,
        productId,
        productTitle: productData.title,
        amount: finalPrice,
        quantity: 1,
        platformFee,
        netAmount: finalPrice - platformFee,
        status: 'escrow_held',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Public transaction record
      const txRef = adminDb.collection('transactions').doc();
      transaction.set(txRef, {
        userId: winnerId,
        senderId: winnerId,
        receiverId: 'escrow',
        amount: finalPrice,
        type: 'escrow_hold',
        status: 'completed',
        description: `Auction Order Payment`,
        createdAt: FieldValue.serverTimestamp()
      });

      // Update user stats
      transaction.update(userRef, {
        totalSpent: FieldValue.increment(finalPrice),
        coins: FieldValue.increment(Math.floor(finalPrice)),
        totalCoinsEarned: FieldValue.increment(Math.floor(finalPrice))
      });

      // Chat Creation
      const chatRef = adminDb.collection('chats').doc(orderRef.id);
      transaction.set(chatRef, {
        participants: [winnerId, productData.sellerId],
        buyerId: winnerId,
        sellerId: productData.sellerId,
        orderId: orderRef.id,
        productId,
        productTitle: productData.title,
        participantDetails: {
          [winnerId]: { name: userData.displayName || 'Buyer', photoURL: userData.photoURL || '', role: userData.role || 'student' },
          [productData.sellerId]: { name: sellerData.displayName || 'Seller', photoURL: sellerData.photoURL || '', role: sellerData.role || 'vendor' }
        },
        createdAt: FieldValue.serverTimestamp(),
        lastMessage: 'Auction Order placed securely.',
        lastMessageAt: FieldValue.serverTimestamp(),
        [`unreadCount.${productData.sellerId}`]: FieldValue.increment(1)
      }, { merge: true });

      // Notifications
      const buyerNotif = adminDb.collection('notifications').doc();
      transaction.set(buyerNotif, {
        userId: winnerId,
        title: 'Auction Won & Paid!',
        message: `You won ${productData.title} and your wallet was automatically debited GH₵${finalPrice.toFixed(2)}. Chat with the seller now!`,
        type: 'order',
        read: false,
        link: '/dashboard/messages',
        createdAt: FieldValue.serverTimestamp()
      });

      const sellerNotif = adminDb.collection('notifications').doc();
      transaction.set(sellerNotif, {
        userId: productData.sellerId,
        title: 'Auction Sold!',
        message: `Your auction ${productData.title} was won by a bidder for GH₵${finalPrice.toFixed(2)}. Funds are in escrow.`,
        type: 'order',
        read: false,
        link: '/dashboard',
        createdAt: FieldValue.serverTimestamp()
      });

      return { success: true, message: 'Auction auto-debited securely.' };
    } else {
      // Insufficient funds: Mark ended and notify winner to pay
      transaction.update(productRef, {
        status: 'ended',
        winnerId,
        finalPrice,
        updatedAt: FieldValue.serverTimestamp()
      });

      const buyerNotif = adminDb.collection('notifications').doc();
      transaction.set(buyerNotif, {
        userId: winnerId,
        title: 'Auction Won! Action Required.',
        message: `You won "${productData.title}" for GH₵${finalPrice.toFixed(2)} but your wallet has insufficient funds. Please checkout.`,
        type: 'auction_won',
        read: false,
        link: `/checkout?product=${productId}`,
        createdAt: FieldValue.serverTimestamp()
      });

      return { success: true, message: 'Auction ended. Outstanding payment required.' };
    }
  });
}
