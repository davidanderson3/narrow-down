import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

function setupDom() {
  return new JSDOM(`
    <div id="restaurantsPanel">
      <div id="restaurantsForm">
        <input id="restaurantsCity" />
        <input id="restaurantsCuisine" />
        <div id="restaurantsApiKeyContainer"><input id="restaurantsApiKey" /></div>
        <button id="restaurantsSearchBtn"></button>
      </div>
      <div id="restaurantsResults"></div>
    </div>
  `);
}

function mockLocalStorage() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); },
    clear: () => { store.clear(); }
  };
}

describe('initRestaurantsPanel', () => {
  let initRestaurantsPanel;

  beforeEach(async () => {
    vi.resetModules();
    ({ initRestaurantsPanel } = await import('../js/restaurants.js'));
    global.localStorage = mockLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
    delete global.window;
    delete global.document;
    delete global.localStorage;
  });

  it('fetches and renders restaurant results', async () => {
    const dom = setupDom();
    global.window = dom.window;
    global.document = dom.window.document;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => global.localStorage
    });

    const sampleData = [
      {
        name: 'Pizza Palace',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        cuisine: 'Pizza',
        phone: '555-1234',
        rating: 4.5,
        website: 'pizzapalace.com'
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleData)
    });

    await initRestaurantsPanel();

    const cityInput = document.getElementById('restaurantsCity');
    const apiKeyInput = document.getElementById('restaurantsApiKey');
    const searchBtn = document.getElementById('restaurantsSearchBtn');

    cityInput.value = 'Austin';
    apiKeyInput.value = 'API_KEY';
    searchBtn.click();

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('city=Austin'),
      expect.objectContaining({ headers: { 'X-Api-Key': 'API_KEY' } })
    );

    const results = document.getElementById('restaurantsResults');
    expect(results.textContent).toContain('Pizza Palace');
    expect(results.textContent).toContain('Pizza');
  });

  it('shows validation message when city missing', async () => {
    const dom = setupDom();
    global.window = dom.window;
    global.document = dom.window.document;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => global.localStorage
    });

    global.fetch = vi.fn();

    await initRestaurantsPanel();

    const apiKeyInput = document.getElementById('restaurantsApiKey');
    apiKeyInput.value = 'API_KEY';
    document.getElementById('restaurantsSearchBtn').click();

    const results = document.getElementById('restaurantsResults');
    expect(results.textContent).toContain('Enter a city');
    expect(fetch).not.toHaveBeenCalled();
  });
});
