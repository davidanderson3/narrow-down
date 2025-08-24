import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const existingPlace = {
  id: 'p1',
  name: 'Old',
  description: '',
  tags: [],
  Rating: '',
  Date: '',
  visited: false,
  lat: 0,
  lon: 0
};
let storedDoc = { ...existingPlace, extra: 'meta' };
const setMock = vi.fn((data, options) => {
  if (options && options.merge) {
    Object.assign(storedDoc, data);
  } else {
    storedDoc = { ...data };
  }
  return Promise.resolve();
});
const db = {
  collection: () => ({
    doc: () => ({
      collection: () => ({
        doc: () => ({ set: setMock }),
        onSnapshot: (...args) => {
          const cb = args.find(a => typeof a === 'function');
          cb && cb({
            docs: [{ id: storedDoc.id, data: () => ({ ...storedDoc }) }],
            metadata: { fromCache: false }
          });
          return () => {};
        }
      })
    })
  })
};

vi.mock('../js/auth.js', () => ({
  db,
  getCurrentUser: () => ({ uid: 'u1' }),
  auth: { onAuthStateChanged: () => {} }
}));

describe('travel record editing', () => {
  it('preserves extra metadata when saving edits', async () => {
    vi.resetModules();
    storedDoc = { ...existingPlace, extra: 'meta' };
    setMock.mockClear();

    const dom = new JSDOM(`
      <div id="travelPanel">
        <div id="travelMap"></div>
        <input id="travelSearch" />
        <input id="placeSearch" />
        <div id="placeResults"></div>
        <div id="travelTagFilters"></div>
        <div id="placeCount"></div>
        <div id="paginationControls">
          <button id="prevPageBtn"></button>
          <span id="pageInfo"></span>
          <button id="nextPageBtn"></button>
        </div>
        <input type="checkbox" id="showVisitedToggle" />
        <table id="travelTable"><tbody></tbody></table>
      </div>
    `, { url: 'http://localhost' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    Object.defineProperty(global, 'navigator', {
      value: {
        geolocation: {
          getCurrentPosition: cb => cb({ coords: { latitude: 0, longitude: 0 } })
        }
      },
      configurable: true
    });
    global.L = {
      icon: vi.fn(() => ({})),
      map: vi.fn(() => ({
        setView: vi.fn().mockReturnThis(),
        invalidateSize: vi.fn(),
        on: vi.fn()
      })),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      marker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        bindPopup: vi.fn().mockReturnThis(),
        on: vi.fn(),
        remove: vi.fn(),
        openPopup: vi.fn()
      }))
    };

    window.localStorage.setItem('travelData-u1', JSON.stringify([existingPlace]));

    const travel = await import('../js/travel.js');
    await travel.initTravelPanel();
    await new Promise(r => setTimeout(r, 0));

    document.querySelector('button[title="Edit"]').click();
    document.querySelector('input[placeholder="name"]').value = 'New Name';
    const saveBtn = [...document.querySelectorAll('button')].find(b => b.textContent === 'Save');
    saveBtn.click();
    await new Promise(r => setTimeout(r, 0));

    expect(setMock).toHaveBeenCalledWith(expect.any(Object), { merge: true });
    expect(storedDoc.extra).toBe('meta');
    expect(storedDoc.name).toBe('New Name');
  });
});

