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

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'dashboard-geocoder' }
  }).catch(e => {
    throw new Error(`Fetch failed: ${e.message}`);
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  const addr = data.address || {};
  const country = addr.country || '';
  const state = addr.state || addr.region || '';
  return { country, state };
}

async function main() {
  const coll = db.collection('users').doc(DEFAULT_USER_ID).collection('travel');
  const snap = await coll.get().catch(e => {
    throw new Error(`Failed to fetch travel docs: ${e.message}`);
  });
  if (snap.empty) {
    console.log('No travel documents found.');
    return;
  }
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!('lat' in data) || !('lon' in data)) {
      console.warn(`Skipping ${doc.id} due to missing coordinates`);
      continue;
    }
    if (data.Country && data.State) {
      console.log(`Skipping ${doc.id}, already has Country and State`);
      continue;
    }
    let result;
    try {
      result = await reverseGeocode(data.lat, data.lon);
    } catch (err) {
      console.error(`Reverse geocode failed for ${doc.id}:`, err.message);
      continue;
    }
    try {
      await doc.ref.update({ Country: result.country, State: result.state });
      console.log(`Updated ${doc.id} -> ${result.country}, ${result.state}`);
      updated++;
    } catch (err) {
      console.error(`Failed to update ${doc.id}:`, err.message);
    }
    await sleep(1100); // be polite to nominatim
  }
  console.log(`\n\uD83C\uDF89 Updated ${updated} documents.`);
}

main().catch(err => {
  console.error('\u2717 Unhandled error:', err.message);
  process.exit(1);
});

