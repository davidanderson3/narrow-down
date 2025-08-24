#!/usr/bin/env node
const fs = require("fs");
const endpoint = "https://query.wikidata.org/sparql";

async function sparql(query) {
  const url = endpoint + "?format=json&query=" + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: {
      "Accept": "application/sparql-results+json",
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 5;
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return sparql(query);
  }
  if (!res.ok) {
    throw new Error("SPARQL error " + res.status + " " + (await res.text()));
  }
  return res.json();
}

function parsePoint(wkt) {
  const m = /Point\(([-\d\.eE]+)\s+([-\d\.eE]+)\)/.exec(wkt);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat];
  return null;
}

async function getCountries() {
  const query = `
SELECT ?country ?countryLabel ?iso2 ?iso3 WHERE {
  ?country wdt:P31 wd:Q6256.
  OPTIONAL { ?country wdt:P297 ?iso2. }
  OPTIONAL { ?country wdt:P298 ?iso3. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
  const data = await sparql(query);
  return data.results.bindings.map(b => ({
    qid: b.country.value.split("/").pop(),
    label: b.countryLabel?.value || "",
    iso2: b.iso2?.value || "",
    iso3: b.iso3?.value || ""
  }));
}

async function getTopCitiesForCountry(countryQID) {
  const query = `
SELECT ?city ?cityLabel ?population ?coord WHERE {
  ?city (wdt:P31/wdt:P279*) wd:Q515;
        wdt:P17 wd:${countryQID};
        wdt:P625 ?coord.
  OPTIONAL { ?city wdt:P1082 ?population. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?population)
LIMIT 10`;
  const data = await sparql(query);
  return data.results.bindings.map(b => {
    const qid = b.city.value.split("/").pop();
    const name = b.cityLabel?.value || qid;
    const pop = b.population ? Number(b.population.value) : null;
    const coords = parsePoint(b.coord.value);
    return { qid, name, population: pop, coords };
  }).filter(x => Array.isArray(x.coords));
}

async function main() {
  const outPath = process.argv[2] || "major_cities.geojson";
  const countries = await getCountries();
  const features = [];
  const concurrency = 5;
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= countries.length) break;
      const c = countries[idx];
      try {
        const cities = await getTopCitiesForCountry(c.qid);
        for (const city of cities) {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: city.coords },
            properties: {
              name: city.name,
              population: city.population,
              country: c.label,
              country_iso2: c.iso2 || null,
              country_iso3: c.iso3 || null,
              city_qid: city.qid,
              country_qid: c.qid
            }
          });
        }
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
        i = i - 1;
      }
      await new Promise(r => setTimeout(r, 120));
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const fc = { type: "FeatureCollection", features };
  fs.writeFileSync(outPath, JSON.stringify(fc));
  console.log("Wrote", outPath, "with", features.length, "features");
}

if (require.main === module) {
  if (typeof fetch !== "function") global.fetch = (...args) => import("node-fetch").then(m => m.default(...args));
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
