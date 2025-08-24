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
  console.log('\uD83D\uDD12 Connecting to Firestore');
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
} catch (err) {
  console.error('Failed to initialize Firebase Admin SDK:', err.message);
  process.exit(1);
}

const db = admin.firestore();

async function removeDuplicates(userId) {
  const docRef = db.collection('decisions').doc(userId);
  const snap = await docRef.get();
  const data = snap.data();
  const items = data && Array.isArray(data.items) ? data.items : [];
  const seenIds = new Set();
  const seenText = new Set();
  const deduped = [];
  for (const it of items) {
    if (it?.id) {
      if (seenIds.has(it.id)) continue;
      seenIds.add(it.id);
    }
    const key = it?.text && it?.type ? `${it.type}|${it.text.toLowerCase()}` : null;
    if (key) {
      if (seenText.has(key)) continue;
      seenText.add(key);
    }
    deduped.push(it);
  }
  if (deduped.length !== items.length) {
    await docRef.set({ items: deduped }, { merge: true });
    console.log(`Removed ${items.length - deduped.length} duplicate decisions`);
  } else {
    console.log('No duplicates found');
  }
}

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error('Usage: node scripts/removeDuplicateDecisions.js <USER_ID>');
  process.exit(1);
}

removeDuplicates(USER_ID)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error removing duplicates:', err);
    process.exit(1);
  });
