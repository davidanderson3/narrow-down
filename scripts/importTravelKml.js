const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`✗ Missing service account key at ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

// Detect emulator vs. prod
const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (isEmulator) {
  console.warn(`⚠️  FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  console.log('🔒 Connecting to PRODUCTION Firestore');
}

// Initialize with explicit projectId
const projectId =
  serviceAccount.project_id ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId,
  });
  console.log(`✔️  Initialized Firebase Admin for project "${projectId}"`);
} catch (err) {
  console.error('✗ Failed to initialize Firebase Admin SDK:', err.message);
  process.exit(1);
}

const db = admin.firestore();
const DEFAULT_USER_ID = '6hWB9QquC1fV2XlX0ixm3Fnq0Sj2';

function parseKml(text) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    ignoreNameSpace: true,
    attributeNamePrefix: '@_',
  });
  let obj;
  try {
    obj = parser.parse(text);
  } catch (err) {
    throw new Error(`XML parse failed: ${err.message}`);
  }
  if (!obj.kml?.Document) {
    console.debug('Parsed top‑level keys:', Object.keys(obj));
    throw new Error('Missing kml.Document node – check for namespaces or malformed KML');
  }
  const raw = obj.kml.Document.Placemark || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map(pm => {
      const coords = pm.Point?.coordinates?.trim();
      const [lon, lat] = coords ? coords.split(',').map(Number) : [NaN, NaN];
      const extended = {};
      if (pm.ExtendedData?.Data) {
        const dataArr = Array.isArray(pm.ExtendedData.Data)
          ? pm.ExtendedData.Data
          : [pm.ExtendedData.Data];
        dataArr.forEach(d => {
          if (d['@_name']) extended[d['@_name']] = d.value || '';
        });
      }
      return {
        name: pm.name?.trim() || 'Unknown',
        description: pm.description || '',
        styleUrl: pm.styleUrl || '',
        visited: /icon-503-62AF44/.test(pm.styleUrl || ''),
        lat,
        lon,
        ...extended,
      };
    })
    .filter(p => !Number.isNaN(p.lat) && !Number.isNaN(p.lon));
}

async function clearCollection(coll) {
  const snap = await coll.get().catch(err => {
    throw new Error(`Failed to fetch ${coll.path}: ${err.message}`);
  });
  if (snap.empty) {
    console.log(`→ [clear] no docs in ${coll.path}, skipping`);
    return;
  }
  console.log(`→ [clear] deleting ${snap.size} docs in ${coll.path}`);
  await Promise.all(
    snap.docs.map(d => d.ref.delete().catch(e => {
      throw new Error(`Failed to delete ${d.id}: ${e.message}`);
    }))
  );
}

async function importPlaces(places, coll) {
  if (places.length === 0) {
    console.warn('⚠️  No places parsed—aborting import');
    return;
  }
  const batchSize = 400;
  let batch = db.batch(), count = 0;
  for (const place of places) {
    const ref = coll.doc();
    batch.set(ref, place);
    count++;
    if (count % batchSize === 0) {
      await batch.commit().catch(e => {
        throw new Error(`Batch commit failed at ${count}: ${e.message}`);
      });
      console.log(`→ [import] committed batch of ${batchSize} (total ${count})`);
      batch = db.batch();
    }
  }
  if (count % batchSize !== 0) {
    await batch.commit().catch(e => {
      throw new Error(`Final batch commit failed at ${count}: ${e.message}`);
    });
    console.log(`→ [import] committed final batch of ${count % batchSize} (total ${count})`);
  }
  console.log(`✔ Imported ${count} places`);
}

async function main() {
  const filePath = 'assets/travel/doc.kml';
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`✗ Cannot read ${filePath}:`, err.message);
    process.exit(1);
  }

  let places;
  try {
    places = parseKml(text);
  } catch (err) {
    console.error('✗ KML parse error:', err.message);
    process.exit(1);
  }

  const coll = db
    .collection('users')
    .doc(DEFAULT_USER_ID)
    .collection('travel');

  try {
    await clearCollection(coll);
    await importPlaces(places, coll);
  } catch (err) {
    console.error('✗ Operation failed:', err.message);
    process.exit(1);
  }

  // VERIFY
  const afterSnap = await coll.get().catch(e => {
    console.error('✗ Verification fetch failed:', e.message);
    process.exit(1);
  });
  console.log(`🔍 After import, ${afterSnap.size} docs in ${coll.path}`);
  if (afterSnap.size !== places.length) {
    console.error(
      `✗ Mismatch: parsed ${places.length}, but found ${afterSnap.size} in Firestore`
    );
    process.exit(1);
  }

  // DEBUG: project, collectionGroup, subcollections
  console.log(`\n⛳️ Writing to project: ${projectId}`);

  const travelSnap = await db.collectionGroup('travel').get();
  console.log(`⛳️ collectionGroup('travel') found ${travelSnap.size} docs:`);
  travelSnap.docs.slice(0, 5).forEach(d => console.log(`  • ${d.ref.path}`));

  console.log(`\n🔍 All user docs and their subcollections:`);
  const usersSnap = await db.collection('users').get();
  for (const u of usersSnap.docs) {
    const sub = await u.ref.listCollections();
    console.log(`  • ${u.id}: [${sub.map(c => c.id).join(', ')}]`);
  }

  console.log(`\n🎉 All good—${afterSnap.size} documents live in Firestore.`);
  process.exit(0);
}

main().catch(err => {
  console.error('✗ Unhandled error:', err.message);
  process.exit(1);
});
