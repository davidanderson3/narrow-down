#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'geolayers-game', 'public', 'data');
const tmpFile = path.join(__dirname, 'major_cities.geojson');
const script = path.join(__dirname, 'majorCities.js');

// run the fetch script to build the GeoJSON of major cities
spawnSync('node', [script, tmpFile], { stdio: 'inherit' });

if (!fs.existsSync(tmpFile)) {
  console.error('Failed to create major cities file');
  process.exit(1);
}

const geo = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
const byCountry = {};
for (const f of geo.features) {
  const iso3 = f.properties.country_iso3;
  if (!iso3) continue;
  (byCountry[iso3] ||= []).push(f);
}

for (const [iso3, features] of Object.entries(byCountry)) {
  const dir = path.join(dataDir, iso3);
  if (!fs.existsSync(dir)) continue;
  const outPath = path.join(dir, 'cities.geojson');
  const fc = { type: 'FeatureCollection', features };
  fs.writeFileSync(outPath, JSON.stringify(fc, null, 2));
  console.log('Wrote', outPath);
}
