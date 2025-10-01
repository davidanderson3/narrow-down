import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const firestoreDocMock = {
  set: vi.fn().mockResolvedValue(),
  get: vi.fn().mockResolvedValue({ exists: false })
};

const collectionMock = vi.fn(() => ({ doc: () => firestoreDocMock }));

const authModuleMock = {
  getCurrentUser: vi.fn(() => null),
  awaitAuthUser: vi.fn(() => Promise.resolve(null)),
  db: { collection: collectionMock }
};

vi.mock('../js/auth.js', () => authModuleMock);

let initMoviesPanel;

function buildDom() {
  return new JSDOM(`
    <div id="movieTabs" class="movie-tabs">
      <button class="movie-tab active" data-target="movieStreamSection"></button>
      <button class="movie-tab" data-target="savedMoviesSection"></button>
      <button class="movie-tab" data-target="watchedMoviesSection"></button>
    </div>
    <div id="movieStreamSection"></div>
    <div id="savedMoviesSection" style="display:none">
      <div id="savedMoviesList"></div>
    </div>
    <div id="watchedMoviesSection" style="display:none">
      <div id="watchedMoviesList"></div>
    </div>
    <div id="movieList"></div>
    <div id="moviesApiKeyContainer"><input id="moviesApiKey" /></div>
  `);
}

function mockLocalStorage() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); },
    clear: () => store.clear()
  };
}

function attachWindow(dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => global.localStorage
  });
}

function configureFetchResponses(responses) {
  global.fetch = vi.fn();
  responses.forEach(res => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(res)
    });
  });
}

describe('initMoviesPanel', () => {
  beforeEach(async () => {
    vi.resetModules();
    authModuleMock.getCurrentUser.mockReturnValue(null);
    authModuleMock.awaitAuthUser.mockResolvedValue(null);
    firestoreDocMock.get.mockResolvedValue({ exists: false });
    firestoreDocMock.set.mockClear();
    collectionMock.mockReturnValue({ doc: () => firestoreDocMock });
    ({ initMoviesPanel } = await import('../js/movies.js'));
    global.localStorage = mockLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
    delete global.window;
    delete global.document;
    delete global.localStorage;
  });

  it('renders movies with action buttons and metadata', async () => {
    const dom = buildDom();
    attachWindow(dom);
    window.tmdbApiKey = 'TEST_KEY';

    const page = {
      results: [
        {
          id: 1,
          title: 'Sample Movie',
          release_date: '2024-01-01',
          vote_average: 7.5,
          vote_count: 12,
          overview: 'An exciting film.',
          genre_ids: [28],
          poster_path: '/poster.jpg'
        }
      ]
    };
    const empty = { results: [] };
    const genres = { genres: [{ id: 28, name: 'Action' }] };

    configureFetchResponses([page, empty, empty, genres]);

    await initMoviesPanel();

    const card = document.querySelector('#movieList li');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Sample Movie');
    expect(card.textContent).toContain('Average Score: 7.5');
    expect(card.textContent).toContain('Votes: 12');
    expect(card.querySelector('.movie-meta')?.textContent).toContain('Genres: Action');

    const buttons = Array.from(card.querySelectorAll('button')).map(b => b.textContent);
    expect(buttons).toEqual(['Watched Already', 'Not Interested', 'Interested']);

    const img = card.querySelector('img');
    expect(img?.src).toContain('https://image.tmdb.org/t/p/w200/poster.jpg');
  });

  it('prioritizes movies using weighted score (75% average, 25% votes)', async () => {
    const dom = buildDom();
    attachWindow(dom);
    window.tmdbApiKey = 'TEST_KEY';

    const page = {
      results: [
        {
          id: 10,
          title: 'High Votes',
          release_date: '2024-05-01',
          vote_average: 8,
          vote_count: 400,
          overview: 'Popular film.',
          genre_ids: []
        },
        {
          id: 11,
          title: 'Low Votes',
          release_date: '2024-06-01',
          vote_average: 8,
          vote_count: 40,
          overview: 'Less popular film.',
          genre_ids: []
        }
      ]
    };
    const empty = { results: [] };
    const genres = { genres: [] };

    configureFetchResponses([page, empty, empty, genres]);

    await initMoviesPanel();

    const headings = Array.from(document.querySelectorAll('#movieList li h3')).map(h => h.textContent);
    expect(headings[0]).toContain('High Votes');
    expect(headings[1]).toContain('Low Votes');
  });

  it('moves interested movies to the interested list with adjustable slider', async () => {
    const dom = buildDom();
    attachWindow(dom);
    window.tmdbApiKey = 'TEST_KEY';

    const page = {
      results: [
        {
          id: 2,
          title: 'Future Hit',
          release_date: '2024-03-15',
          vote_average: 8.2,
          vote_count: 44,
          overview: 'Must-watch film.',
          genre_ids: [],
          poster_path: '/future.jpg'
        }
      ]
    };
    const empty = { results: [] };
    const genres = { genres: [] };

    configureFetchResponses([page, empty, empty, genres]);

    await initMoviesPanel();

    const interestedBtn = Array.from(document.querySelectorAll('#movieList li button')).find(
      b => b.textContent === 'Interested'
    );
    interestedBtn?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.querySelector('#movieList').textContent).toContain('No new movies right now.');
    const slider = document.querySelector('#savedMoviesList input[type="range"]');
    expect(slider).not.toBeNull();
    expect(slider.value).toBe('3');

    const label = document.querySelector('#savedMoviesList .interest-row span');
    expect(label?.textContent).toBe('Interest: 3');

    slider.value = '5';
    slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    slider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(label?.textContent).toBe('Interest: 5');
    const stored = JSON.parse(global.localStorage.getItem('moviePreferences'));
    expect(stored['2'].interest).toBe(5);
  });

  it('persists API key and restores it from storage', async () => {
    const dom = buildDom();
    attachWindow(dom);

    const page = {
      results: [
        {
          id: 7,
          title: 'Stored Key Movie',
          release_date: '2023-12-01',
          vote_average: 6.1,
          vote_count: 21,
          overview: 'Stored key data.',
          genre_ids: []
        }
      ]
    };
    const empty = { results: [] };
    const genres = { genres: [] };

    configureFetchResponses([page, empty, empty, genres]);

    await initMoviesPanel();

    const input = document.getElementById('moviesApiKey');
    input.value = 'INPUT_KEY';
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    // allow async change handler to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.localStorage.getItem('moviesApiKey')).toBe('INPUT_KEY');
    const calledUrls = fetch.mock.calls.map(args => args[0]);
    expect(calledUrls.some(url => url.includes('api_key=INPUT_KEY&sort_by=popularity.desc'))).toBe(true);
  });

  it('moves watched movies to the watched list and allows removal', async () => {
    const dom = buildDom();
    attachWindow(dom);
    window.tmdbApiKey = 'TEST_KEY';

    const page = {
      results: [
        {
          id: 3,
          title: 'Classic Film',
          release_date: '1999-07-16',
          vote_average: 9.1,
          vote_count: 900,
          overview: 'A timeless classic.',
          genre_ids: []
        }
      ]
    };
    const empty = { results: [] };
    const genres = { genres: [] };

    configureFetchResponses([page, empty, empty, genres]);

    await initMoviesPanel();

    const watchedBtn = Array.from(document.querySelectorAll('#movieList li button')).find(
      b => b.textContent === 'Watched Already'
    );
    watchedBtn?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.querySelector('#watchedMoviesList').textContent).toContain('Classic Film');

    const removeBtn = document.querySelector('#watchedMoviesList button');
    removeBtn?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.querySelector('#movieList').textContent).toContain('Classic Film');
  });

  it('saves preferences to Firestore for authenticated users', async () => {
    const dom = buildDom();
    attachWindow(dom);

    const userId = 'user123';
    authModuleMock.awaitAuthUser.mockResolvedValue({ uid: userId });
    authModuleMock.getCurrentUser.mockReturnValue({ uid: userId });
    firestoreDocMock.get.mockResolvedValue({ exists: true, data: () => ({ prefs: {} }) });

    const page = {
      results: [
        {
          id: 9,
          title: 'Firestore Movie',
          release_date: '2024-04-01',
          vote_average: 7,
          vote_count: 120,
          overview: 'Stored remotely.',
          genre_ids: []
        }
      ]
    };
    const empty = { results: [] };
    const genres = { genres: [] };

    configureFetchResponses([page, empty, empty, genres]);

    await initMoviesPanel();

    const interestedBtn = Array.from(document.querySelectorAll('#movieList li button')).find(
      b => b.textContent === 'Interested'
    );
    interestedBtn?.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(firestoreDocMock.set).toHaveBeenCalled();
  });
});
