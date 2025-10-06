const DEFAULT_API_TOKEN = '';

const STORAGE_KEYS = {
  token: 'eventbriteApiToken',
  query: 'eventbriteQuery',
  location: 'eventbriteLocation',
  radius: 'eventbriteRadius'
};

let initialized = false;
let autoLoaded = false;
let currentAbortController = null;

function readStorage(key) {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(key) || '';
  } catch (err) {
    console.warn('Unable to read storage', err);
    return '';
  }
}

function writeStorage(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('Unable to persist storage', err);
  }
}

function truncate(text, maxLength = 240) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function formatDate(start) {
  const iso = start?.local || start?.utc;
  if (!iso) return 'Date to be announced';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch (err) {
    console.warn('Unable to format Eventbrite date', err);
    return date.toLocaleString();
  }
}

function formatVenue(venue, onlineEvent) {
  const parts = [];
  if (venue?.name) parts.push(venue.name);
  const address =
    venue?.address?.localized_address_display ||
    [venue?.address?.city, venue?.address?.region]
      .filter(Boolean)
      .join(', ');
  if (address) parts.push(address);
  if (onlineEvent) parts.push('Online event');
  return parts.join(' • ');
}

function createActionLink(text, url) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  link.style.display = 'inline-flex';
  link.style.alignItems = 'center';
  link.style.gap = '4px';
  link.style.fontWeight = '600';
  link.style.color = '#1b6b44';
  return link;
}

function renderEvents(listEl, events) {
  listEl.innerHTML = '';
  if (!events.length) {
    listEl.innerHTML = '<p><em>No events found. Try a different search.</em></p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  events.forEach(event => {
    const card = document.createElement('article');
    card.className = 'decision-card';

    const title = document.createElement('h3');
    title.className = 'decision-title';
    title.textContent = event?.name?.text || 'Untitled event';
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.style.fontSize = '0.9rem';
    meta.style.marginBottom = '0.35rem';
    const metaParts = [];
    metaParts.push(formatDate(event?.start));
    const venueText = formatVenue(event?.venue, event?.online_event);
    if (venueText) metaParts.push(venueText);
    if (typeof event?.is_free === 'boolean') {
      metaParts.push(event.is_free ? 'Free' : 'Paid');
    }
    if (event?.status && event.status !== 'live') {
      metaParts.push(`Status: ${event.status}`);
    }
    meta.textContent = metaParts.filter(Boolean).join(' • ');
    card.appendChild(meta);

    const description = truncate(event?.description?.text || '');
    if (description) {
      const descEl = document.createElement('p');
      descEl.textContent = description;
      descEl.style.marginBottom = '0.5rem';
      card.appendChild(descEl);
    }

    const footer = document.createElement('div');
    footer.className = 'button-row';
    footer.style.flexWrap = 'wrap';
    footer.style.gap = '8px';

    if (event?.url) {
      footer.appendChild(createActionLink('View on Eventbrite', event.url));
    }

    if (event?.venue?.name && event?.venue?.address?.localized_address_display) {
      const encoded = encodeURIComponent(event.venue.address.localized_address_display);
      footer.appendChild(
        createActionLink(
          'Open in Maps',
          `https://www.google.com/maps/search/?api=1&query=${encoded}`
        )
      );
    }

    if (footer.children.length) {
      card.appendChild(footer);
    }

    fragment.appendChild(card);
  });

  listEl.appendChild(fragment);
}

function showMessage(listEl, message, { allowHTML = false } = {}) {
  listEl.innerHTML = '';
  const wrapper = document.createElement('p');
  const emphasis = document.createElement('em');
  if (allowHTML) {
    emphasis.innerHTML = message;
  } else {
    emphasis.textContent = message;
  }
  wrapper.appendChild(emphasis);
  listEl.appendChild(wrapper);
}

async function fetchEvents({ token, query, location, radius }) {
  if (!token) {
    throw new Error(
      'Enter an Eventbrite API token from the Eventbrite developer dashboard.'
    );
  }

  if (!query && !location) {
    throw new Error('Enter keywords or a location to search events.');
  }

  if (currentAbortController) {
    currentAbortController.abort();
  }
  const controller = new AbortController();
  currentAbortController = controller;

  const params = new URLSearchParams();
  params.set('sort_by', 'date');
  params.set('expand', 'venue');
  params.set('start_date.range_start', new Date().toISOString());
  if (query) params.set('q', query);
  if (location) {
    params.set('location.address', location);
    if (radius) params.set('location.within', radius);
  }

  try {
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const contentType = response.headers?.get('content-type') || '';
      let message = `Eventbrite request failed with status ${response.status}`;
      let extraDetail = '';

      if (contentType.includes('application/json')) {
        try {
          const errorBody = await response.json();
          if (errorBody?.error_description) {
            extraDetail = errorBody.error_description;
          } else if (Array.isArray(errorBody?.error?.error_detail)) {
            extraDetail = errorBody.error.error_detail.join(', ');
          } else if (typeof errorBody?.error === 'string') {
            extraDetail = errorBody.error;
          }
        } catch (err) {
          // ignore parsing errors
        }
      } else {
        try {
          const text = (await response.text()).trim();
          if (text) {
            extraDetail = text;
          }
        } catch (err) {
          // ignore text parsing errors
        }
      }

      if ([401, 403].includes(response.status)) {
        message =
          'Eventbrite rejected the request. Confirm that your API token is valid and has access to the Event Search endpoint.';
      } else if (response.status === 404) {
        message =
          'Eventbrite could not find the requested resource. This often happens when the API token does not have Event Search permissions.';
      }

      if (extraDetail && !message.includes(extraDetail)) {
        message = `${message} (${extraDetail})`;
      }

      throw new Error(message);
    }

    const data = await response.json();
    return Array.isArray(data?.events) ? data.events : [];
  } finally {
    if (currentAbortController === controller) {
      currentAbortController = null;
    }
  }
}

export async function initEventbritePanel() {
  const listEl = document.getElementById('eventbriteResults');
  if (!listEl) return;

  const tokenInput = document.getElementById('eventbriteToken');
  const queryInput = document.getElementById('eventbriteQuery');
  const locationInput = document.getElementById('eventbriteLocation');
  const radiusSelect = document.getElementById('eventbriteRadius');
  const searchBtn = document.getElementById('eventbriteSearchBtn');

  if (!initialized) {
    if (tokenInput) {
      const storedToken = readStorage(STORAGE_KEYS.token);
      tokenInput.value = storedToken || DEFAULT_API_TOKEN;
    }
    if (queryInput) queryInput.value = readStorage(STORAGE_KEYS.query);
    if (locationInput) locationInput.value = readStorage(STORAGE_KEYS.location);
    if (radiusSelect) {
      const storedRadius = readStorage(STORAGE_KEYS.radius);
      if (storedRadius) radiusSelect.value = storedRadius;
    }

    const triggerSearch = async () => {
      const token = tokenInput?.value.trim();
      const query = queryInput?.value.trim();
      const location = locationInput?.value.trim();
      const radius = radiusSelect?.value || '';

      writeStorage(STORAGE_KEYS.token, token);
      writeStorage(STORAGE_KEYS.query, query);
      writeStorage(STORAGE_KEYS.location, location);
      writeStorage(STORAGE_KEYS.radius, radius);

      showMessage(listEl, 'Loading events…');
      try {
        const events = await fetchEvents({ token, query, location, radius });
        renderEvents(listEl, events);
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }
        console.error('Unable to load Eventbrite events', err);
        showMessage(listEl, err.message || 'Unable to load events.');
      }
    };

    const handleEnter = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        triggerSearch();
      }
    };

    queryInput?.addEventListener('keydown', handleEnter);
    locationInput?.addEventListener('keydown', handleEnter);
    tokenInput?.addEventListener('keydown', handleEnter);
    radiusSelect?.addEventListener('change', () => {
      writeStorage(STORAGE_KEYS.radius, radiusSelect.value);
    });

    if (searchBtn) {
      searchBtn.addEventListener('click', triggerSearch);
    }

    initialized = true;
  }

  if (!autoLoaded) {
    const token = tokenInput?.value.trim();
    const query = queryInput?.value.trim();
    const location = locationInput?.value.trim();

    if (token && (query || location)) {
      autoLoaded = true;
      searchBtn?.click();
    } else if (!listEl.innerHTML.trim()) {
      showMessage(
        listEl,
        'Enter an Eventbrite API token from the <a href="https://www.eventbrite.com/platform/api-keys/" target="_blank" rel="noopener noreferrer">Eventbrite developer dashboard</a> plus keywords or a location to discover events.',
        { allowHTML: true }
      );
    }
  }
}

if (typeof window !== 'undefined') {
  window.initEventbritePanel = initEventbritePanel;
}
