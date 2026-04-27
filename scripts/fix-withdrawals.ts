import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Initialize Firebase Admin
try {
  let firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  let serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'));

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: firebaseConfig.projectId,
    });
  }
} catch (e) {
  console.error("Could not load credentials", e);
  process.exit(1);
}

const db = admin.firestore();

async function fixStrandedTransactions() {
  console.log("Looking for stranded pending withdrawal transactions...");
  
  const pendingTxsSnapshot = await db.collection('transactions')
    .where('type', '==', 'withdrawal')
    .where('status', '==', 'pending')
    .get();

  if (pendingTxsSnapshot.empty) {
    console.log("No pending withdrawal transactions found.");
    return;
  }

  console.log(`Found ${pendingTxsSnapshot.docs.length} pending withdrawal transactions.`);

  let fixedCount = 0;

  for (const txDoc of pendingTxsSnapshot.docs) {
    const txData = txDoc.data();
    console.log(`\nChecking transaction ${txDoc.id} for user ${txData.userId} (amount: ${txData.amount})`);

    // Check if there's a corresponding ALREADY APPROVED withdrawal
    const approvedWithdrawalsSnapshot = await db.collection('withdrawals')
      .where('userId', '==', txData.userId)
      .where('amount', '==', txData.amount)
      .where('status', '==', 'approved')
      .get();

    if (!approvedWithdrawalsSnapshot.empty) {
      console.log(`-> Found corresponding APPROVED withdrawal. Fixing transaction to 'completed'.`);
      await txDoc.ref.update({
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      fixedCount++;
    } else {
      console.log(`-> No corresponding APPROVED withdrawal found. Leaves it as pending.`);
    }
  }

  console.log(`\nFinished checking. Fixed ${fixedCount} stranded transactions.`);
}

fixStrandedTransactions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
