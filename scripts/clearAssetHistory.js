const fs = require('fs');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`\u2717 Missing service account key at ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (isEmulator) {
  console.warn(`\u26A0\uFE0F  FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  console.log('\uD83D\uDD12 Connecting to PRODUCTION Firestore');
}

const projectId = serviceAccount.project_id || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });
  console.log(`\u2714\uFE0F  Initialized Firebase Admin for project "${projectId}"`);
} catch (err) {
  console.error('\u2717 Failed to initialize Firebase Admin SDK:', err.message);
  process.exit(1);
}

const db = admin.firestore();
const DEFAULT_USER_ID = '6hWB9QquC1fV2XlX0ixm3Fnq0Sj2';

async function main() {
  const coll = db.collection('users').doc(DEFAULT_USER_ID).collection('assetHistory');
  const snap = await coll.get().catch(e => {
    throw new Error(`Failed to fetch asset snapshots: ${e.message}`);
  });
  if (snap.empty) {
    console.log('No asset snapshots found.');
    return;
  }
  let deleted = 0;
  const batch = db.batch();
  snap.docs.forEach(doc => {
    batch.delete(doc.ref);
    deleted++;
  });
  await batch.commit().catch(e => {
    throw new Error(`Failed to delete snapshots: ${e.message}`);
  });
  console.log(`\n\uD83D\uDDD1\uFE0F Deleted ${deleted} asset snapshots.`);
}

main().catch(err => {
  console.error('\u2717 Unhandled error:', err.message);
  process.exit(1);
});
