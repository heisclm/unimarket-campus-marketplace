import { db, handleFirestoreError, OperationType } from './firebase';
import { 
  doc, 
  runTransaction, 
  collection, 
  serverTimestamp, 
  getDoc,
  updateDoc
} from 'firebase/firestore';

import { getAuth } from 'firebase/auth';

export type OrderStatus = 'pending' | 'escrow_held' | 'delivered' | 'completed' | 'disputed' | 'cancelled' | 'refunded';

/**
 * Step 1: Buyer places order (SECURE BACKEND CALL)
 */
export async function placeOrderWithEscrow(
  buyerId: string,
  sellerId: string,
  productId: string,
  productTitle: string,
  amount: number,
  deliveryMethod: 'pickup' | 'delivery'
) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const idToken = await user.getIdToken();

  const response = await fetch('/api/escrow/hold', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ productId, deliveryMethod })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to place order');
  }

  return data.orderId;
}

/**
 * Step 2: Seller marks as delivered
 */
export async function markOrderAsDelivered(orderId: string, sellerId: string) {
  const orderRef = doc(db, 'orders', orderId);
  try {
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found");
    const orderData = orderSnap.data();

    if (orderData.sellerId !== sellerId) throw new Error("Unauthorized");
    if (orderData.status !== 'escrow_held') throw new Error("Invalid order status");

    await updateDoc(orderRef, {
      status: 'delivered',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

/**
 * Step 3: Buyer confirms receipt (SECURE BACKEND CALL)
 */
export async function confirmOrderReceipt(orderId: string, buyerId: string) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const idToken = await user.getIdToken();

  const response = await fetch('/api/escrow/release', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ orderId })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to confirm receipt');
  }

  return data;
}

/**
 * Step 4: Buyer raises dispute
 */
export async function raiseOrderDispute(orderId: string, buyerId: string, reason: string) {
  const orderRef = doc(db, 'orders', orderId);
  try {
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found");
    const orderData = orderSnap.data();

    if (orderData.buyerId !== buyerId) throw new Error("Unauthorized");
    if (orderData.status !== 'delivered' && orderData.status !== 'escrow_held') {
      throw new Error("Cannot dispute this order");
    }

    await updateDoc(orderRef, {
      status: 'disputed',
      disputeReason: reason,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
}

/**
 * Admin: Resolve Dispute (Release to Seller)
 */
export async function adminReleaseEscrow(orderId: string, adminNote: string) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const idToken = await user.getIdToken();

  const response = await fetch('/api/escrow/admin/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ orderId, action: 'release', adminNote })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to resolve escrow');
  }

  return data;
}

/**
 * Admin: Resolve Dispute (Refund to Buyer)
 */
export async function adminRefundEscrow(orderId: string, adminNote: string) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const idToken = await user.getIdToken();

  const response = await fetch('/api/escrow/admin/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ orderId, action: 'refund', adminNote })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to refund escrow');
  }

  return data;
}
