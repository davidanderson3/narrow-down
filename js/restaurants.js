const API_BASE_URL =
  (typeof window !== 'undefined' && window.apiBaseUrl) ||
  (typeof process !== 'undefined' && process.env.API_BASE_URL) ||
  (typeof window !== 'undefined' ? window.location.origin : '');
const STORAGE_KEY = 'restaurantsApiKey';

let initialized = false;

function persistApiKey(key) {
  if (!key) return;
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch (_) {
    /* ignore */
  }
}

function getStoredKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch (_) {
    return '';
  }
}

function renderLoading(container) {
  container.innerHTML = '<em>Loading restaurants...</em>';
}

function renderMessage(container, message) {
  container.innerHTML = `<em>${message}</em>`;
}

function renderResults(container, items) {
  if (!items.length) {
    renderMessage(container, 'No restaurants found.');
    return;
  }
  const ul = document.createElement('ul');
  items.forEach(rest => {
    const li = document.createElement('li');
    li.className = 'restaurant-card';

    const title = document.createElement('h3');
    title.textContent = rest.name || 'Unnamed Restaurant';
    li.appendChild(title);

    const meta = document.createElement('ul');
    meta.className = 'restaurant-meta';

    if (rest.address) {
      const m = document.createElement('li');
      m.textContent = rest.address;
      meta.appendChild(m);
    }

    const details = [];
    if (rest.city) details.push(rest.city);
    if (rest.state) details.push(rest.state);
    if (rest.zip) details.push(rest.zip);
    if (details.length) {
      const m = document.createElement('li');
      m.textContent = details.join(', ');
      meta.appendChild(m);
    }

    if (rest.cuisine) {
      const m = document.createElement('li');
      m.textContent = `Cuisine: ${rest.cuisine}`;
      meta.appendChild(m);
    }

    if (rest.phone) {
      const m = document.createElement('li');
      m.textContent = `Phone: ${rest.phone}`;
      meta.appendChild(m);
    }

    if (rest.rating) {
      const m = document.createElement('li');
      m.textContent = `Rating: ${rest.rating}`;
      meta.appendChild(m);
    }

    if (rest.website) {
      const m = document.createElement('li');
      const link = document.createElement('a');
      link.href = rest.website.startsWith('http') ? rest.website : `https://${rest.website}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Website';
      m.appendChild(link);
      meta.appendChild(m);
    }

    if (meta.childNodes.length) li.appendChild(meta);

    ul.appendChild(li);
  });
  container.innerHTML = '';
  container.appendChild(ul);
}

async function fetchRestaurants({ apiKey, city, cuisine }) {
  const params = new URLSearchParams();
  params.set('city', city);
  if (cuisine) params.set('cuisine', cuisine);
  params.set('limit', '20');

  const base = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '';
  const res = await fetch(`${base}/api/restaurants?${params.toString()}`, {
    headers: {
      'X-Api-Key': apiKey
    }
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function initRestaurantsPanel() {
  if (initialized) return;
  initialized = true;

  const resultsContainer = document.getElementById('restaurantsResults');
  if (!resultsContainer) return;

  const cityInput = document.getElementById('restaurantsCity');
  const cuisineInput = document.getElementById('restaurantsCuisine');
  const apiKeyInput = document.getElementById('restaurantsApiKey');
  const searchBtn = document.getElementById('restaurantsSearchBtn');

  const storedKey = getStoredKey();
  if (apiKeyInput && storedKey) {
    apiKeyInput.value = storedKey;
    const container = document.getElementById('restaurantsApiKeyContainer');
    if (container) container.style.display = 'none';
  }

  async function handleSearch() {
    if (!cityInput) return;
    const city = cityInput.value.trim();
    const cuisine = cuisineInput?.value.trim() || '';
    const apiKey = apiKeyInput?.value.trim() || storedKey;

    if (!apiKey) {
      renderMessage(resultsContainer, 'Enter your API Ninjas key.');
      apiKeyInput?.focus();
      return;
    }
    if (!city) {
      renderMessage(resultsContainer, 'Enter a city to search.');
      cityInput.focus();
      return;
    }

    persistApiKey(apiKey);
    renderLoading(resultsContainer);

    try {
      const data = await fetchRestaurants({ apiKey, city, cuisine });
      renderResults(resultsContainer, data);
    } catch (err) {
      console.error('Restaurant search failed', err);
      renderMessage(resultsContainer, 'Failed to load restaurants. Check your API key and try again.');
    }
  }

  searchBtn?.addEventListener('click', handleSearch);
  apiKeyInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });
  cityInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });
}

if (typeof window !== 'undefined') {
  window.initRestaurantsPanel = initRestaurantsPanel;
  window.dispatchEvent(new Event('restaurantsPanelReady'));
}
