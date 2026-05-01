import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest';

let testEnv: RulesTestEnvironment;

describe('Wallet & Ledger Security Rules', () => {
  beforeAll(async () => {
    // Initialize the test environment with the current firestore.rules
    testEnv = await initializeTestEnvironment({
      projectId: 'unimart-wallet-test',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // 1. Identity Spoofing & Escrow Escalation Tests
  it('should deny users from directly modifying their walletBalance via client (The "Ghost Update" attack)', async () => {
    const userId = 'user123';
    
    // Setup initial state as system/admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${userId}`).set({
        uid: userId,
        email: 'user123@example.com',
        displayName: 'John Doe',
        role: 'student',
        walletBalance: 0,
        isVerified: true,
        createdAt: new Date(),
      });
    });

    // Authenticate as the user
    const db = testEnv.authenticatedContext(userId).firestore();
    const userRef = db.doc(`users/${userId}`);

    // Attempt to spoof balance update (this mimics a logic leak attack)
    await assertFails(
      userRef.update({
        walletBalance: 100000,
      })
    );
  });

  // 2. Ledger Isolation Tests
  it('should deny users from directly reading or writing to the wallet_ledger', async () => {
    const userId = 'user123';
    const db = testEnv.authenticatedContext(userId).firestore();

    // The user tries to create a ledger entry bypassing the server logic
    await assertFails(
      db.collection('wallet_ledger').add({
        userId,
        amount: 500,
        type: 'deposit',
      })
    );
  });

  // 3. Transactions Attack Test
  it('should deny users from approving their own transactions', async () => {
    const userId = 'user123';
    const txId = 'tx456';
    
    // Setup initial pending transaction
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`transactions/${txId}`).set({
        userId,
        amount: 500,
        type: 'deposit',
        status: 'pending'
      });
    });

    const db = testEnv.authenticatedContext(userId).firestore();
    const txRef = db.doc(`transactions/${txId}`);

    // The user attempts to set state to "approved" to trick client UI
    await assertFails(
      txRef.update({
        status: 'approved' // this should fail via the `allow update: if isAdmin();` barrier
      })
    );
  });

  // 4. Admin Access Validation
  it('should allow admins full access to ledger and wallet balances', async () => {
    const adminId = 'admin789';
    const userId = 'user123';
    
    // Create the admin doc
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${adminId}`).set({
        uid: adminId,
        email: 'admin@example.com',
        role: 'admin',
        walletBalance: 0,
        isVerified: true,
      });
    });

    // Admin context
    const adminDb = testEnv.authenticatedContext(adminId).firestore();
    
    // Admin creates an entry in wallet ledger
    await assertSucceeds(
      adminDb.collection('wallet_ledger').add({
        userId,
        amount: 500,
        type: 'deposit',
      })
    );
  });
});
