const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');
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

const projectId =
  serviceAccount.project_id || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
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

async function importPlaces(places, coll) {
  if (places.length === 0) {
    console.warn('\u26A0\uFE0F  No places parsed—aborting import');
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
      console.log(`\u2192 [import] committed batch of ${batchSize} (total ${count})`);
      batch = db.batch();
    }
  }
  if (count % batchSize !== 0) {
    await batch.commit().catch(e => {
      throw new Error(`Final batch commit failed at ${count}: ${e.message}`);
    });
    console.log(`\u2192 [import] committed final batch of ${count % batchSize} (total ${count})`);
  }
  console.log(`\u2714 Imported ${count} places`);
}

async function main() {
  const filePath = 'assets/travel/extra.kml';
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`\u2717 Cannot read ${filePath}:`, err.message);
    process.exit(1);
  }

  let places;
  try {
    places = parseKml(text);
  } catch (err) {
    console.error('\u2717 KML parse error:', err.message);
    process.exit(1);
  }

  const coll = db.collection('users').doc(DEFAULT_USER_ID).collection('travel');

  try {
    await importPlaces(places, coll);
  } catch (err) {
    console.error('\u2717 Operation failed:', err.message);
    process.exit(1);
  }

  const afterSnap = await coll.get().catch(e => {
    console.error('\u2717 Verification fetch failed:', e.message);
    process.exit(1);
  });
  console.log(`\uD83D\uDD0D After import, ${afterSnap.size} docs in ${coll.path}`);
  console.log(`\n\uD83C\uDF89 Added ${places.length} new places.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\u2717 Unhandled error:', err.message);
  process.exit(1);
});
