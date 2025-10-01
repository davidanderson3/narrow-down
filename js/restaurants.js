const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const STORAGE_KEY = 'restaurantsLocation';
const DEFAULT_LOCATION = {
  label: 'New York, NY',
  lat: 40.7128,
  lon: -74.006
};
const SEARCH_RADIUS_METERS = 3000;

let initialized = false;
let currentAbortController = null;

function setStatus(statusEl, message, kind = 'info') {
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.style.color = kind === 'error' ? '#b00020' : '#333';
}

function loadStoredLocation() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to read stored restaurant location', err);
    return null;
  }
}

function saveStoredLocation(location) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch (err) {
    console.warn('Failed to save restaurant location', err);
  }
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function renderRestaurants(listEl, restaurants) {
  if (!listEl) return;
  if (!restaurants.length) {
    listEl.textContent = 'No restaurants found nearby. Try another location.';
    return;
  }

  const ul = document.createElement('ul');
  restaurants.forEach(item => {
    const li = document.createElement('li');
    li.className = 'restaurant-card';

    const header = document.createElement('div');
    header.className = 'restaurant-header';

    const nameEl = document.createElement('strong');
    nameEl.textContent = item.name;
    header.appendChild(nameEl);

    if (typeof item.distanceKm === 'number') {
      const distanceEl = document.createElement('span');
      distanceEl.className = 'restaurant-distance';
      distanceEl.textContent = `${item.distanceKm.toFixed(1)} km away`;
      header.appendChild(distanceEl);
    }

    li.appendChild(header);

    if (item.address) {
      const addressEl = document.createElement('div');
      addressEl.className = 'restaurant-address';
      addressEl.textContent = item.address;
      li.appendChild(addressEl);
    }

    if (item.cuisines.length) {
      const cuisinesEl = document.createElement('div');
      cuisinesEl.className = 'restaurant-cuisines';
      cuisinesEl.textContent = `Cuisines: ${item.cuisines.join(', ')}`;
      li.appendChild(cuisinesEl);
    }

    if (item.openingHours) {
      const hoursEl = document.createElement('div');
      hoursEl.className = 'restaurant-hours';
      hoursEl.textContent = `Hours: ${item.openingHours}`;
      li.appendChild(hoursEl);
    }

    if (item.phone || item.website || (item.lat && item.lon)) {
      const linksEl = document.createElement('div');
      linksEl.className = 'restaurant-links';

      if (item.phone) {
        const phoneLink = document.createElement('a');
        phoneLink.href = `tel:${item.phone.replace(/[^+\d]/g, '')}`;
        phoneLink.textContent = item.phone;
        phoneLink.rel = 'noopener noreferrer';
        linksEl.appendChild(phoneLink);
      }

      if (item.website) {
        const websiteLink = document.createElement('a');
        websiteLink.href = item.website;
        websiteLink.textContent = 'Website';
        websiteLink.target = '_blank';
        websiteLink.rel = 'noopener noreferrer';
        if (linksEl.childElementCount) linksEl.appendChild(document.createTextNode(' · '));
        linksEl.appendChild(websiteLink);
      }

      if (item.lat && item.lon) {
        const mapLink = document.createElement('a');
        mapLink.href = `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=18/${item.lat}/${item.lon}`;
        mapLink.textContent = 'View on map';
        mapLink.target = '_blank';
        mapLink.rel = 'noopener noreferrer';
        if (linksEl.childElementCount) linksEl.appendChild(document.createTextNode(' · '));
        linksEl.appendChild(mapLink);
      }

      li.appendChild(linksEl);
    }

    ul.appendChild(li);
  });

  listEl.innerHTML = '';
  listEl.appendChild(ul);
}

async function fetchRestaurantsForCoords(lat, lon, originLabel, listEl, statusEl) {
  if (!listEl) return;

  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  setStatus(statusEl, `Searching for restaurants near ${originLabel}...`);
  listEl.innerHTML = '<em>Loading restaurants...</em>';

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"](around:${SEARCH_RADIUS_METERS},${lat},${lon});
      way["amenity"="restaurant"](around:${SEARCH_RADIUS_METERS},${lat},${lon});
      relation["amenity"="restaurant"](around:${SEARCH_RADIUS_METERS},${lat},${lon});
    );
    out center tags;
  `;

  const params = new URLSearchParams();
  params.set('data', query);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: params.toString(),
      signal
    });

    if (!response.ok) {
      throw new Error(`Overpass API error ${response.status}`);
    }

    const data = await response.json();
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const restaurants = [];
    const seen = new Set();

    elements.forEach(el => {
      if (!el || seen.has(el.id)) return;
      const tags = el.tags || {};
      const name = tags.name?.trim() || 'Unnamed restaurant';
      const rawCuisines = tags.cuisine ? String(tags.cuisine).split(';') : [];
      const cuisines = rawCuisines.map(c => c.trim()).filter(Boolean);
      const addressParts = [];
      const streetLine = [tags['addr:housenumber'], tags['addr:street']]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (streetLine) addressParts.push(streetLine);
      ['addr:city', 'addr:state', 'addr:postcode'].forEach(key => {
        if (tags[key]) addressParts.push(tags[key]);
      });
      const address = addressParts.join(', ');
      const latVal = typeof el.lat === 'number' ? el.lat : el.center?.lat;
      const lonVal = typeof el.lon === 'number' ? el.lon : el.center?.lon;
      const distanceKm =
        typeof latVal === 'number' && typeof lonVal === 'number'
          ? haversineDistanceKm(lat, lon, latVal, lonVal)
          : null;
      const phone = tags.phone || tags['contact:phone'] || '';
      const website = tags.website || tags['contact:website'] || '';
      const openingHours = tags.opening_hours || '';

      restaurants.push({
        id: el.id,
        name,
        cuisines,
        address,
        phone,
        website,
        openingHours,
        lat: latVal,
        lon: lonVal,
        distanceKm
      });
      seen.add(el.id);
    });

    restaurants.sort((a, b) => {
      if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') {
        return a.distanceKm - b.distanceKm;
      }
      if (typeof a.distanceKm === 'number') return -1;
      if (typeof b.distanceKm === 'number') return 1;
      return a.name.localeCompare(b.name);
    });

    renderRestaurants(listEl, restaurants);
    if (restaurants.length) {
      setStatus(statusEl, `Showing restaurants within ${(SEARCH_RADIUS_METERS / 1000).toFixed(1)} km of ${originLabel}.`);
    } else {
      setStatus(statusEl, `No restaurants found near ${originLabel}.`, 'error');
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return;
    }
    console.error('Failed to fetch restaurants', err);
    setStatus(statusEl, 'Failed to load restaurants. Please try again.', 'error');
    listEl.textContent = 'Unable to load restaurants right now.';
  }
}

async function geocodeLocation(query) {
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'en'
    }
  });
  if (!response.ok) {
    throw new Error(`Nominatim error ${response.status}`);
  }
  const results = await response.json();
  if (!Array.isArray(results) || !results.length) {
    return null;
  }
  const top = results[0];
  return {
    lat: parseFloat(top.lat),
    lon: parseFloat(top.lon),
    label: top.display_name || query
  };
}

function requestGeolocation() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('geolocation unavailable'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000
    });
  });
}

export function initRestaurantsPanel() {
  if (initialized) return;
  initialized = true;

  const listEl = document.getElementById('restaurantsList');
  const statusEl = document.getElementById('restaurantsStatus');
  const searchBtn = document.getElementById('restaurantsSearchBtn');
  const geolocateBtn = document.getElementById('restaurantsUseGeolocation');
  const locationInput = document.getElementById('restaurantsLocationInput');

  if (!listEl) return;

  const handleManualSearch = async () => {
    const query = locationInput?.value.trim();
    if (!query) {
      setStatus(statusEl, 'Please enter a location to search.', 'error');
      return;
    }
    setStatus(statusEl, `Looking up ${query}...`);
    try {
      const location = await geocodeLocation(query);
      if (!location) {
        setStatus(statusEl, 'No matching location found. Try a more specific search.', 'error');
        return;
      }
      if (locationInput) {
        locationInput.value = location.label;
      }
      saveStoredLocation(location);
      await fetchRestaurantsForCoords(location.lat, location.lon, location.label, listEl, statusEl);
    } catch (err) {
      console.error('Failed to search location', err);
      setStatus(statusEl, 'Failed to search for that location.', 'error');
    }
  };

  searchBtn?.addEventListener('click', () => {
    handleManualSearch();
  });

  locationInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleManualSearch();
    }
  });

  geolocateBtn?.addEventListener('click', async () => {
    setStatus(statusEl, 'Requesting your location...');
    try {
      const position = await requestGeolocation();
      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        label: 'your location'
      };
      if (locationInput) {
        locationInput.value = '';
      }
      saveStoredLocation({ lat: coords.lat, lon: coords.lon, label: 'Your location' });
      await fetchRestaurantsForCoords(coords.lat, coords.lon, 'your location', listEl, statusEl);
    } catch (err) {
      console.error('Geolocation failed', err);
      setStatus(statusEl, 'Could not access your location. Try entering a city or ZIP code.', 'error');
    }
  });

  const storedLocation = loadStoredLocation();
  if (storedLocation) {
    if (locationInput) {
      locationInput.value = storedLocation.label;
    }
    fetchRestaurantsForCoords(
      storedLocation.lat,
      storedLocation.lon,
      storedLocation.label,
      listEl,
      statusEl
    );
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    setStatus(statusEl, 'Requesting your location...');
    requestGeolocation()
      .then(position => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: 'your location'
        };
        saveStoredLocation({ lat: coords.lat, lon: coords.lon, label: 'Your location' });
        fetchRestaurantsForCoords(coords.lat, coords.lon, 'your location', listEl, statusEl);
      })
      .catch(err => {
        console.warn('Automatic geolocation failed', err);
        if (locationInput) {
          locationInput.value = DEFAULT_LOCATION.label;
        }
        setStatus(statusEl, 'Showing restaurants near a default location. Enter a city to search your area.');
        fetchRestaurantsForCoords(
          DEFAULT_LOCATION.lat,
          DEFAULT_LOCATION.lon,
          DEFAULT_LOCATION.label,
          listEl,
          statusEl
        );
      });
  } else {
    if (locationInput) {
      locationInput.value = DEFAULT_LOCATION.label;
    }
    setStatus(statusEl, 'Geolocation not supported. Showing a default area.');
    fetchRestaurantsForCoords(
      DEFAULT_LOCATION.lat,
      DEFAULT_LOCATION.lon,
      DEFAULT_LOCATION.label,
      listEl,
      statusEl
    );
  }
}

if (typeof window !== 'undefined') {
  window.initRestaurantsPanel = initRestaurantsPanel;
}
