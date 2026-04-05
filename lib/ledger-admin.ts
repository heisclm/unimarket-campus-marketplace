import { adminDb } from './firebase-admin';
import * as admin from 'firebase-admin';

export type LedgerTransactionType = 
  | 'deposit' 
  | 'withdrawal' 
  | 'escrow_hold' 
  | 'escrow_release' 
  | 'escrow_refund' 
  | 'payment_received';

interface LedgerEntry {
  userId: string;
  amount: number;
  type: LedgerTransactionType;
  orderId?: string;
  description: string;
}

/**
 * Securely updates a user's wallet balance and records a ledger entry.
 * Must be called within a transaction if possible, or it will create its own.
 */
export async function updateWalletWithLedger(
  transaction: admin.firestore.Transaction,
  entry: LedgerEntry
) {
  if (!adminDb) throw new Error("Admin DB not initialized");

  const userRef = adminDb.collection('users').doc(entry.userId);
  const userSnap = await transaction.get(userRef);

  if (!userSnap.exists) {
    throw new Error(`User ${entry.userId} not found`);
  }

  const userData = userSnap.data() || {};
  const previousBalance = userData.walletBalance || 0;
  const newBalance = previousBalance + entry.amount;

  if (newBalance < 0 && entry.type !== 'escrow_hold') {
    // We might allow escrow_hold to go slightly negative if there's a race, 
    // but generally we should check before calling this.
    // For now, let's be strict.
    throw new Error("Insufficient funds for this transaction");
  }

  // 1. Update User Balance
  transaction.update(userRef, {
    walletBalance: newBalance,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Create Ledger Entry
  const ledgerRef = adminDb.collection('wallet_ledger').doc();
  transaction.set(ledgerRef, {
    userId: entry.userId,
    amount: entry.amount,
    type: entry.type,
    orderId: entry.orderId || null,
    previousBalance,
    newBalance,
    description: entry.description,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { previousBalance, newBalance };
}
