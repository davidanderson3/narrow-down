const STORAGE_KEYS = {
  token: 'facebookAccessToken',
  pageId: 'facebookPageId',
  limit: 'facebookEventLimit'
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

function formatDate(iso) {
  if (!iso) return 'Date to be announced';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch (err) {
    console.warn('Unable to format Facebook date', err);
    return date.toLocaleString();
  }
}

function formatLocation(place, onlineEvent) {
  const parts = [];
  if (place?.name) parts.push(place.name);
  const location = place?.location;
  if (location) {
    const segments = [location.city, location.state || location.region, location.country]
      .filter(Boolean)
      .join(', ');
    if (segments) parts.push(segments);
  }
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
    listEl.innerHTML = '<p><em>No events found for this page. Try another ID or increase the limit.</em></p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  events.forEach(event => {
    const card = document.createElement('article');
    card.className = 'decision-card';

    const title = document.createElement('h3');
    title.className = 'decision-title';
    title.textContent = event?.name || 'Untitled event';
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.style.fontSize = '0.9rem';
    meta.style.marginBottom = '0.35rem';
    const metaParts = [];
    metaParts.push(formatDate(event?.start_time));
    const locationText = formatLocation(event?.place, event?.online_event);
    if (locationText) metaParts.push(locationText);
    if (event?.is_canceled) metaParts.push('Canceled');
    meta.textContent = metaParts.filter(Boolean).join(' • ');
    card.appendChild(meta);

    const description = truncate(event?.description || '');
    if (description) {
      const descEl = document.createElement('p');
      descEl.textContent = description;
      descEl.style.marginBottom = '0.5rem';
      card.appendChild(descEl);
    }

    if (Array.isArray(event?.event_times) && event.event_times.length) {
      const occurrences = document.createElement('ul');
      occurrences.style.margin = '0 0 0.5rem 1.25rem';
      occurrences.style.fontSize = '0.9rem';
      const upcoming = event.event_times.slice(0, 3);
      upcoming.forEach(time => {
        const item = document.createElement('li');
        item.textContent = `${formatDate(time.start_time)}${time.end_time ? ` – ${formatDate(time.end_time)}` : ''}`;
        occurrences.appendChild(item);
      });
      if (event.event_times.length > upcoming.length) {
        const more = document.createElement('li');
        more.textContent = `+ ${event.event_times.length - upcoming.length} more occurrence(s)`;
        occurrences.appendChild(more);
      }
      card.appendChild(occurrences);
    }

    const stats = [];
    if (typeof event?.interested_count === 'number') {
      stats.push(`${event.interested_count.toLocaleString()} interested`);
    }
    if (typeof event?.attending_count === 'number') {
      stats.push(`${event.attending_count.toLocaleString()} going`);
    }
    if (typeof event?.maybe_count === 'number') {
      stats.push(`${event.maybe_count.toLocaleString()} maybe`);
    }
    if (stats.length) {
      const statsEl = document.createElement('div');
      statsEl.style.fontSize = '0.85rem';
      statsEl.style.marginBottom = '0.5rem';
      statsEl.textContent = stats.join(' • ');
      card.appendChild(statsEl);
    }

    const footer = document.createElement('div');
    footer.className = 'button-row';
    footer.style.flexWrap = 'wrap';
    footer.style.gap = '8px';

    if (event?.id) {
      footer.appendChild(createActionLink('View on Facebook', `https://www.facebook.com/events/${event.id}`));
    }
    if (event?.ticket_uri) {
      footer.appendChild(createActionLink('Tickets', event.ticket_uri));
    }
    if (event?.place?.location?.latitude && event?.place?.location?.longitude) {
      const { latitude, longitude } = event.place.location;
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      footer.appendChild(createActionLink('Open in Maps', mapUrl));
    }

    if (footer.children.length) {
      card.appendChild(footer);
    }

    fragment.appendChild(card);
  });

  listEl.appendChild(fragment);
}

function showMessage(listEl, message) {
  listEl.innerHTML = `<p><em>${message}</em></p>`;
}

async function fetchFacebookEvents({ token, pageId, limit }) {
  if (!token) {
    throw new Error('Please provide a Facebook access token.');
  }
  if (!pageId) {
    throw new Error('Enter a Page or organizer ID to load events.');
  }

  if (currentAbortController) {
    currentAbortController.abort();
  }
  const controller = new AbortController();
  currentAbortController = controller;

  const version = 'v19.0';
  const endpoint = `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/events`;
  const url = new URL(endpoint);
  url.searchParams.set('access_token', token);
  url.searchParams.set('time_filter', 'upcoming');
  url.searchParams.set('limit', String(limit || 10));
  url.searchParams.set(
    'fields',
    [
      'name',
      'start_time',
      'end_time',
      'place',
      'description',
      'online_event',
      'event_times',
      'ticket_uri',
      'is_canceled',
      'interested_count',
      'maybe_count',
      'attending_count',
      'cover'
    ].join(',')
  );

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.error?.message || `Facebook request failed with status ${response.status}`;
      throw new Error(message);
    }

    return Array.isArray(data?.data) ? data.data : [];
  } finally {
    if (currentAbortController === controller) {
      currentAbortController = null;
    }
  }
}

export async function initFacebookEventsPanel() {
  const listEl = document.getElementById('facebookEventsList');
  if (!listEl) return;

  const tokenInput = document.getElementById('facebookAccessToken');
  const pageIdInput = document.getElementById('facebookPageId');
  const limitSelect = document.getElementById('facebookLimit');
  const fetchBtn = document.getElementById('facebookFetchBtn');

  if (!initialized) {
    if (tokenInput) tokenInput.value = readStorage(STORAGE_KEYS.token);
    if (pageIdInput) pageIdInput.value = readStorage(STORAGE_KEYS.pageId);
    if (limitSelect) {
      const storedLimit = readStorage(STORAGE_KEYS.limit);
      if (storedLimit) limitSelect.value = storedLimit;
    }

    const triggerFetch = async () => {
      const token = tokenInput?.value.trim();
      const pageId = pageIdInput?.value.trim();
      const limit = limitSelect?.value || '10';

      if (!token) {
        showMessage(listEl, 'Enter a Facebook access token to load events.');
        return;
      }

      if (!pageId) {
        showMessage(listEl, 'Enter a Page or organizer ID to load events.');
        return;
      }

      writeStorage(STORAGE_KEYS.token, token);
      writeStorage(STORAGE_KEYS.pageId, pageId);
      writeStorage(STORAGE_KEYS.limit, limit);

      showMessage(listEl, 'Loading events…');
      try {
        const events = await fetchFacebookEvents({ token, pageId, limit });
        renderEvents(listEl, events);
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }
        console.error('Unable to load Facebook events', err);
        showMessage(listEl, err.message || 'Unable to load Facebook events.');
      }
    };

    const handleEnter = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        triggerFetch();
      }
    };

    tokenInput?.addEventListener('keydown', handleEnter);
    pageIdInput?.addEventListener('keydown', handleEnter);
    limitSelect?.addEventListener('change', () => {
      writeStorage(STORAGE_KEYS.limit, limitSelect.value);
    });

    if (fetchBtn) {
      fetchBtn.addEventListener('click', triggerFetch);
    }

    initialized = true;
  }

  if (!autoLoaded) {
    const token = tokenInput?.value.trim();
    const pageId = pageIdInput?.value.trim();
    if (token && pageId) {
      autoLoaded = true;
      fetchBtn?.click();
    } else if (!listEl.innerHTML.trim()) {
      showMessage(
        listEl,
        'Enter an access token and Facebook Page ID to load upcoming events.'
      );
    }
  }
}

if (typeof window !== 'undefined') {
  window.initFacebookEventsPanel = initFacebookEventsPanel;
}
