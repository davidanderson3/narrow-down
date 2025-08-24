let locationId = '';
let finished = false;
const guess = document.getElementById('guess');
let map;
let outline;
let citiesLayer;
let citiesShown = false;

function pickLocation(locations) {
  return locations[Math.floor(Math.random() * locations.length)];
}

fetch('countries.json').then(r=>r.json()).then(data=>{
  data.sort((a,b)=>a.name.localeCompare(b.name));
  for (const c of data) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.name;
    guess.appendChild(opt);
  }
  const locations = data.map(c=>c.code);
  locationId = pickLocation(locations);
  loadCountry();
});

function loadCountry() {
  Promise.all([
    fetch(`data/${locationId}/outline.geojson`).then(r => r.json()),
    fetch(`data/${locationId}/rivers.geojson`).then(r => r.json())
  ]).then(([outlineGeo, riversGeo]) => {
    if (!map) {
      map = L.map('map', { zoomControl: false, attributionControl: false });
    } else {
      map.eachLayer(l => map.removeLayer(l));
    }

    citiesLayer = null;
    citiesShown = false;

    outline = L.geoJSON(outlineGeo);
    const riversLayer = L.geoJSON(riversGeo, { style: { color: '#0ff' } });

    // Use the outline to determine map bounds and zoom closely to the country
    const bounds = outline.getBounds().pad(0.1);
    map.fitBounds(bounds);

    riversLayer.addTo(map);
  });
}

function showCities() {
  fetch(`data/${locationId}/cities.geojson`).then(r => {
    if (!r.ok) return null;
    return r.json();
  }).then(citiesGeo => {
    if (!citiesGeo) return;
    citiesLayer = L.geoJSON(citiesGeo, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, { radius: 5, color: '#f00' }).bindTooltip(feature.properties.name)
    });
    citiesLayer.addTo(map);
    citiesShown = true;
  }).catch(() => {});
}

guess.addEventListener('change', () => {
  if (finished) return;
  const val = guess.value;
  if (!val) return;
  if (val === locationId) {
    document.getElementById('score').textContent = `Correct! It is ${val}.`;
    finished = true;
    outline.addTo(map);
    map.fitBounds(outline.getBounds().pad(0.1));
  } else {
    document.getElementById('score').textContent = 'Incorrect, try again!';
    if (!citiesShown) {
      showCities();
    }
  }
});
