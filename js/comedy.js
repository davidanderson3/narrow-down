const API_BASE_URL =
  (typeof window !== 'undefined' && window.apiBaseUrl) ||
  (typeof process !== 'undefined' && process.env.API_BASE_URL) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

let comedyLocationRequested = false;
let cachedComedyLocation = null;

const COMEDY_PREFS_STORAGE_KEY = 'comedyPreferences';
let comedyPreferences = loadStoredComedyPreferences();
let currentComedyEvents = [];
let comedyEmptyReason = null;

function loadStoredComedyPreferences() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COMEDY_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Unable to parse comedy preferences from storage', err);
    return {};
  }
}

function saveComedyPreferences(prefs) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COMEDY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Unable to save comedy preferences', err);
  }
}

function updateComedyStatus(id, status) {
  if (!id) return;
  const next = { ...comedyPreferences };
  if (!status) {
    delete next[id];
  } else {
    next[id] = { status, updatedAt: Date.now() };
  }
  comedyPreferences = next;
  saveComedyPreferences(comedyPreferences);
  renderComedyList();
}

function getComedyStatus(id) {
  return comedyPreferences[id]?.status || null;
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatEventDate(start) {
  if (!start?.localDate) return '';
  const { localDate, localTime } = start;
  let isoString = localDate;
  if (localTime) {
    isoString += `T${localTime}`;
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return localTime ? `${localDate} ${localTime}` : localDate;
  }
  const options = { dateStyle: 'medium' };
  if (localTime) {
    options.timeStyle = 'short';
  }
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch (err) {
    console.warn('Unable to format comedy event date', err);
    return localTime ? `${localDate} ${localTime}` : localDate;
  }
}

function renderComedyList() {
  const listEl = document.getElementById('comedyList');
  const interestedEl = document.getElementById('comedyInterestedList');
  if (!listEl && !interestedEl) return;

  if (listEl) listEl.innerHTML = '';
  if (interestedEl) interestedEl.innerHTML = '';

  if (!currentComedyEvents.length) {
    if (listEl) {
      const emptyMessage =
        comedyEmptyReason === 'noNearby'
          ? 'No stand-up shows nearby within 300 miles.'
          : comedyEmptyReason === 'locationDenied'
            ? 'Allow location access to discover nearby stand-up comedy.'
            : 'No stand-up comedy shows available right now.';
      const emptyEl = document.createElement('p');
      emptyEl.className = 'shows-empty';
      emptyEl.textContent = emptyMessage;
      listEl.appendChild(emptyEl);
    }
    if (interestedEl) {
      const emptyInterested = document.createElement('p');
      emptyInterested.className = 'shows-empty';
      emptyInterested.textContent = 'No saved stand-up comedy events yet.';
      interestedEl.appendChild(emptyInterested);
    }
    return;
  }

  const active = [];
  const dismissed = [];
  const interested = [];
  for (const item of currentComedyEvents) {
    const status = getComedyStatus(item.id);
    const enriched = { ...item, status };
    if (status === 'interested') {
      interested.push(enriched);
    }
    if (status === 'notInterested') {
      dismissed.push(enriched);
    } else {
      active.push(enriched);
    }
  }

  if (listEl) {
    if (active.length) {
      const activeList = document.createElement('ul');
      activeList.className = 'shows-grid';
      for (const item of active) {
        activeList.appendChild(createComedyCard(item));
      }
      listEl.appendChild(activeList);
    } else {
      const noActive = document.createElement('p');
      noActive.className = 'shows-empty';
      noActive.textContent = dismissed.length
        ? 'No other stand-up shows right now. Review the ones you skipped below.'
        : 'No stand-up shows nearby within 300 miles.';
      listEl.appendChild(noActive);
    }

    if (dismissed.length) {
      const dismissedSection = document.createElement('details');
      dismissedSection.className = 'shows-dismissed';

      const summary = document.createElement('summary');
      summary.className = 'shows-dismissed__summary';
      summary.textContent = `Not Interested (${dismissed.length})`;
      dismissedSection.appendChild(summary);

      const dismissedList = document.createElement('ul');
      dismissedList.className = 'shows-grid shows-grid--dismissed';
      for (const item of dismissed) {
        dismissedList.appendChild(createComedyCard(item));
      }
      dismissedSection.appendChild(dismissedList);

      listEl.appendChild(dismissedSection);
    }
  }

  if (interestedEl) {
    if (interested.length) {
      const interestedList = document.createElement('ul');
      interestedList.className = 'shows-grid';
      for (const item of interested) {
        interestedList.appendChild(createComedyCard(item));
      }
      interestedEl.appendChild(interestedList);
    } else {
      const emptyInterested = document.createElement('p');
      emptyInterested.className = 'shows-empty';
      emptyInterested.textContent = 'No saved stand-up comedy events yet. Mark events as Interested to add them here.';
      interestedEl.appendChild(emptyInterested);
    }
  }
}

function createComedyCard(item) {
  const { event, venue, distance, status } = item;

  const li = document.createElement('li');
  li.className = 'show-card';
  if (status === 'interested') {
    li.classList.add('show-card--interested');
  }

  const imageUrl =
    event.images?.find(image => image.ratio === '16_9')?.url || event.images?.[0]?.url;
  if (imageUrl) {
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'show-card__media';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `${event.name || 'Event'} poster`;
    img.loading = 'lazy';
    imageWrapper.appendChild(img);
    li.appendChild(imageWrapper);
  }

  const content = document.createElement('div');
  content.className = 'show-card__content';

  const header = document.createElement('header');
  header.className = 'show-card__header';

  const nameHeading = document.createElement('h3');
  nameHeading.className = 'show-card__title';
  nameHeading.textContent = event.name || 'Unnamed event';
  header.appendChild(nameHeading);

  if (status === 'interested') {
    const chip = document.createElement('span');
    chip.className = 'show-card__status';
    chip.textContent = 'Interested';
    header.appendChild(chip);
  }

  const meta = document.createElement('div');
  meta.className = 'show-card__meta';

  const date = event.dates?.start?.localDate;
  if (date) {
    const dateDiv = document.createElement('div');
    dateDiv.className = 'show-card__date';
    dateDiv.textContent = formatEventDate(event.dates?.start);
    meta.appendChild(dateDiv);
  }

  if (Number.isFinite(distance)) {
    const distanceDiv = document.createElement('div');
    distanceDiv.className = 'show-card__tag';
    distanceDiv.textContent = `${distance.toFixed(0)} miles away`;
    meta.appendChild(distanceDiv);
  }

  if (meta.childElementCount > 0) {
    header.appendChild(meta);
  }

  content.appendChild(header);

  const locParts = [venue?.name, venue?.city?.name, venue?.state?.stateCode].filter(Boolean);
  if (locParts.length > 0) {
    const locDiv = document.createElement('div');
    locDiv.className = 'show-card__location';
    locDiv.textContent = locParts.join(' · ');
    content.appendChild(locDiv);
  }

  const actions = document.createElement('div');
  actions.className = 'show-card__actions';

  const interestedBtn = document.createElement('button');
  interestedBtn.type = 'button';
  interestedBtn.className = 'show-card__btn';
  interestedBtn.textContent = status === 'interested' ? 'Interested ✓' : 'Interested';
  interestedBtn.addEventListener('click', () => {
    const nextStatus = status === 'interested' ? null : 'interested';
    updateComedyStatus(item.id, nextStatus);
  });
  actions.appendChild(interestedBtn);

  const notInterestedBtn = document.createElement('button');
  notInterestedBtn.type = 'button';
  notInterestedBtn.className = 'show-card__btn show-card__btn--secondary';
  notInterestedBtn.textContent = status === 'notInterested' ? 'Undo' : 'Not Interested';
  notInterestedBtn.addEventListener('click', () => {
    const nextStatus = status === 'notInterested' ? null : 'notInterested';
    updateComedyStatus(item.id, nextStatus);
  });
  actions.appendChild(notInterestedBtn);

  content.appendChild(actions);

  if (event.url) {
    const link = document.createElement('a');
    link.href = event.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'show-card__cta';
    link.textContent = 'Get Tickets';
    content.appendChild(link);
  }

  li.appendChild(content);
  return li;
}

async function getComedyLocation() {
  if (comedyLocationRequested) {
    return cachedComedyLocation;
  }
  comedyLocationRequested = true;
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000
      });
    });
    cachedComedyLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  } catch (err) {
    console.warn('Unable to retrieve location for stand-up comedy shows', err);
    cachedComedyLocation = null;
  }
  return cachedComedyLocation;
}

let comedyPanelInitialized = false;
let comedyLoadShows = null;
let comedyServerHasTicketmasterKey = false;

export async function initComedyPanel() {
  const listEl = document.getElementById('comedyList');
  if (!listEl) return;

  if (!comedyPanelInitialized) {
    comedyPanelInitialized = true;

    const interestedListEl = document.getElementById('comedyInterestedList');
    const apiKeyInput = document.getElementById('comedyTicketmasterApiKey');
    const loadBtn = document.getElementById('comedyLoadBtn');
    const tabsContainer = document.getElementById('comedyTabs');

    if (tabsContainer) {
      const tabButtons = Array.from(tabsContainer.querySelectorAll('.comedy-tab'));
      const sections = new Map(
        tabButtons.map(btn => [btn.dataset.target, document.getElementById(btn.dataset.target)])
      );
      tabButtons.forEach(btn => {
        if (btn._comedyTabHandler) {
          btn.removeEventListener('click', btn._comedyTabHandler);
        }
        const handler = () => {
          tabButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          sections.forEach((section, id) => {
            if (!section) return;
            section.style.display = id === btn.dataset.target ? '' : 'none';
          });
        };
        btn._comedyTabHandler = handler;
        btn.addEventListener('click', handler);
      });
      const initialTab =
        tabButtons.find(btn => btn.classList.contains('active')) || tabButtons[0];
      if (initialTab?._comedyTabHandler) {
        initialTab._comedyTabHandler();
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/spotify-client-id`);
      if (res.ok) {
        const data = await res.json();
        comedyServerHasTicketmasterKey = Boolean(data.hasTicketmasterKey);
      }
    } catch (err) {
      console.error('Failed to check Ticketmaster configuration', err);
      comedyServerHasTicketmasterKey = false;
    }

    if (comedyServerHasTicketmasterKey && apiKeyInput) {
      apiKeyInput.style.display = 'none';
      if (loadBtn) {
        loadBtn.textContent = 'Refresh';
      }
    }

    comedyLoadShows = async () => {
      const interestedContainer = interestedListEl;
      if (interestedContainer) {
        interestedContainer.innerHTML = '';
      }

      const requiresManualApiKey = !comedyServerHasTicketmasterKey;
      const manualApiKey =
        apiKeyInput?.value.trim() ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('ticketmasterApiKey')) || '';

      if (requiresManualApiKey && !manualApiKey) {
        listEl.textContent = 'Please enter your Ticketmaster API key.';
        return;
      }

      if (requiresManualApiKey && apiKeyInput?.value && typeof localStorage !== 'undefined') {
        localStorage.setItem('ticketmasterApiKey', manualApiKey);
      } else if (!requiresManualApiKey && typeof localStorage !== 'undefined') {
        localStorage.removeItem('ticketmasterApiKey');
      }

      listEl.innerHTML = '<em>Loading...</em>';
      try {
        const location = await getComedyLocation();
        if (!location) {
          comedyEmptyReason = 'locationDenied';
          currentComedyEvents = [];
          renderComedyList();
          return;
        }

        const tmUrl = new URL(`${API_BASE_URL}/api/ticketmaster`);
        tmUrl.searchParams.set('classificationName', 'Comedy');
        tmUrl.searchParams.set('latlong', `${location.latitude},${location.longitude}`);
        tmUrl.searchParams.set('radius', '200');
        tmUrl.searchParams.set('size', '100');
        tmUrl.searchParams.set('keyword', 'comedy');
        if (requiresManualApiKey) {
          tmUrl.searchParams.set('apiKey', manualApiKey);
        }

        const res = await fetch(tmUrl.toString());
        if (!res.ok) {
          if (res.status === 429) {
            listEl.textContent = 'Ticketmaster rate limit reached. Try again later.';
            return;
          }
          throw new Error(`Ticketmaster HTTP ${res.status}`);
        }

        const data = await res.json();
        const events = data._embedded?.events;
        if (!Array.isArray(events) || events.length === 0) {
          currentComedyEvents = [];
          comedyEmptyReason = 'noNearby';
          renderComedyList();
          return;
        }

        const eventItems = [];
        let counter = 0;
        for (const event of events) {
          const venue = event._embedded?.venues?.[0];
          const lat = Number.parseFloat(venue?.location?.latitude);
          const lon = Number.parseFloat(venue?.location?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            continue;
          }
          const distance = calculateDistanceMiles(
            location.latitude,
            location.longitude,
            lat,
            lon
          );
          if (!Number.isFinite(distance) || distance > 300) {
            continue;
          }
          const id = event.id || `${event.name || 'event'}-${counter}`;
          eventItems.push({
            id,
            event,
            venue,
            distance,
            order: counter++
          });
        }

        if (eventItems.length === 0) {
          currentComedyEvents = [];
          comedyEmptyReason = 'noNearby';
          renderComedyList();
          return;
        }

        eventItems.sort((a, b) => {
          if (a.distance === b.distance) return a.order - b.order;
          return a.distance - b.distance;
        });

        currentComedyEvents = eventItems;
        comedyEmptyReason = null;
        renderComedyList();
      } catch (err) {
        console.error('Failed to load stand-up comedy shows', err);
        listEl.textContent = 'Failed to load stand-up comedy shows.';
      }
    };

    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        comedyLoadShows?.();
      });
    }
  }

  if (typeof comedyLoadShows === 'function') {
    await comedyLoadShows();
  }
}

window.initComedyPanel = initComedyPanel;
