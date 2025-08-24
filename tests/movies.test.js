import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { initMoviesPanel, API_BASE_URL } from '../js/movies.js';

// Minimal DOM setup for the movies panel
describe('initMoviesPanel', () => {
  beforeEach(() => {
    const dom = new JSDOM('<div id="movieList"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    window.tmdbApiKey = 'TEST_KEY';
  });

    it('renders movie titles with review info from TMDB', async () => {
    const apiData = {
      results: [
        {
          title: 'Sample Movie',
          release_date: '2024-01-01',
          vote_average: 7.5,
          vote_count: 12,
          genre_ids: [28],
          overview: 'An exciting film',
          adult: false,
          backdrop_path: '/path.jpg',
          id: 123,
          original_title: 'Original Title',
          poster_path: '/poster.jpg'
        }
      ]
    };
    const creditsData = {
      cast: [{ name: 'Actor A' }, { name: 'Actor B' }],
      crew: [{ job: 'Director', name: 'Dir One' }]
    };
    const genreData = { genres: [{ id: 28, name: 'Action' }] };

    const emptyPage = { results: [] };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiData)
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(creditsData)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(genreData)
      });

    await initMoviesPanel();

    const item = document.querySelector('#movieList li');
    expect(item.textContent).toContain('Sample Movie');
    expect(item.textContent).toContain('Vote Average: 7.5');
    expect(item.textContent).toContain('Vote Count: 12');
    expect(item.textContent).toContain('Director: Dir One');
    expect(item.textContent).toContain('Actors: Actor A, Actor B');
    expect(item.textContent).toContain('Genres: Action');
    expect(item.textContent).toContain('An exciting film');
    expect(item.textContent).not.toContain('overview:');
    expect(item.textContent).not.toContain('adult:');
    expect(item.textContent).not.toContain('backdrop_path:');
    expect(item.textContent).not.toContain('id:');
    expect(item.textContent).not.toContain('original_title:');
    const img = document.querySelector('#movieList li img');
    expect(img).not.toBeNull();
    expect(img.src).toContain('https://image.tmdb.org/t/p/w200/poster.jpg');
    const buttons = document.querySelectorAll('#movieList li button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toBe('💾');
    expect(buttons[1].textContent).toBe('👁️');
    expect(buttons[2].textContent).toBe('❌');
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.themoviedb.org/3/discover/movie?api_key=TEST_KEY&sort_by=release_date.desc&page=1'
    );
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      'https://api.themoviedb.org/3/movie/123/credits?api_key=TEST_KEY'
    );
    expect(fetch).toHaveBeenNthCalledWith(
      7,
      'https://api.themoviedb.org/3/genre/movie/list?api_key=TEST_KEY'
    );
  });

  it('sorts movies by release date closest to today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));

    const apiData = {
      results: [
        {
          title: 'Far Movie',
          release_date: '2023-12-31',
          vote_average: 7,
          vote_count: 20,
          genre_ids: [],
          id: 1
        },
        {
          title: 'Near Movie',
          release_date: '2024-01-20',
          vote_average: 6,
          vote_count: 20,
          genre_ids: [],
          id: 2
        }
      ]
    };
    const emptyPage = { results: [] };
    const creditsData = { cast: [], crew: [] };
    const genreData = { genres: [] };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(apiData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(creditsData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(creditsData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(genreData) });

    try {
      await initMoviesPanel();

      const items = [...document.querySelectorAll('#movieList > ul > li')];
      expect(items[0].textContent).toContain('Near Movie');
      expect(items[1].textContent).toContain('Far Movie');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses entered API key and caches it', async () => {
    const dom = new JSDOM(`
      <div id="movieList"></div>
      <div id="moviesApiKeyContainer"><input id="moviesApiKey" /></div>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    let stored = '';
    let hidden = '[]';
    let watched = '[]';
    global.localStorage = {
      getItem: key => {
        if (key === 'moviesApiKey') return stored;
        if (key === 'hiddenMovieIds') return hidden;
        if (key === 'watchedMovieIds') return watched;
        return '';
      },
      setItem: (key, value) => {
        if (key === 'moviesApiKey') stored = value;
        if (key === 'hiddenMovieIds') hidden = value;
        if (key === 'watchedMovieIds') watched = value;
      }
    };
    Object.defineProperty(window, 'localStorage', { value: global.localStorage });
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    Object.defineProperty(window, 'sessionStorage', { value: global.sessionStorage });

    const apiData = {
      results: [
        {
          id: 1,
          title: 'Any Movie',
          release_date: '2024-01-01',
          genre_ids: [],
          vote_count: 10
        }
      ]
    };
    const creditsData = { cast: [], crew: [] };
    const genreData = { genres: [] };
    const emptyPage = { results: [] };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiData)
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(creditsData)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(genreData)
      });

    await initMoviesPanel();
    const input = document.getElementById('moviesApiKey');
    input.value = 'INPUT_KEY';
    input.dispatchEvent(new dom.window.Event('change'));
    await new Promise(r => setTimeout(r, 0));

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.themoviedb.org/3/discover/movie?api_key=INPUT_KEY&sort_by=release_date.desc&page=1'
    );
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      'https://api.themoviedb.org/3/movie/1/credits?api_key=INPUT_KEY'
    );
    expect(fetch).toHaveBeenNthCalledWith(
      7,
      'https://api.themoviedb.org/3/genre/movie/list?api_key=INPUT_KEY'
    );
    expect(stored).toBe('INPUT_KEY');
  });

  it('caches API key even when fetch fails', async () => {
    const dom = new JSDOM(`
      <div id="movieList"></div>
      <div id="moviesApiKeyContainer"><input id="moviesApiKey" /></div>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    let stored = '';
    let hidden = '[]';
    let watched = '[]';
    global.localStorage = {
      getItem: key => {
        if (key === 'moviesApiKey') return stored;
        if (key === 'hiddenMovieIds') return hidden;
        if (key === 'watchedMovieIds') return watched;
        return '';
      },
      setItem: (key, value) => {
        if (key === 'moviesApiKey') stored = value;
        if (key === 'hiddenMovieIds') hidden = value;
        if (key === 'watchedMovieIds') watched = value;
      }
    };
    Object.defineProperty(window, 'localStorage', { value: global.localStorage });
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    Object.defineProperty(window, 'sessionStorage', { value: global.sessionStorage });

    global.fetch = vi.fn(() => Promise.reject(new Error('fail')));

    await initMoviesPanel();
    const input = document.getElementById('moviesApiKey');
    input.value = 'FAIL_KEY';
    input.dispatchEvent(new dom.window.Event('change'));
    await new Promise(r => setTimeout(r, 0));

    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/discover/movie?api_key=FAIL_KEY&sort_by=release_date.desc&page=1'
    );
    expect(stored).toBe('FAIL_KEY');
  });

  it('removes movie on hide and persists id', async () => {
    const dom = new JSDOM('<div id="movieList"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    window.tmdbApiKey = 'TEST_KEY';

    let hidden = '[]';
    let watched = '[]';
    global.localStorage = {
      getItem: key => {
        if (key === 'hiddenMovieIds') return hidden;
        if (key === 'watchedMovieIds') return watched;
        return '';
      },
      setItem: (key, value) => {
        if (key === 'hiddenMovieIds') hidden = value;
        if (key === 'watchedMovieIds') watched = value;
      }
    };
    Object.defineProperty(window, 'localStorage', { value: global.localStorage });
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    Object.defineProperty(window, 'sessionStorage', { value: global.sessionStorage });

    const apiData = {
      results: [
        {
          id: 321,
          title: 'Hide Me',
          release_date: '2024-01-01',
          poster_path: '/a.jpg',
          genre_ids: [],
          vote_count: 10
        }
      ]
    };
    const genreData = { genres: [] };

    const emptyPage = { results: [] };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(apiData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ cast: [], crew: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(genreData) });

    await initMoviesPanel();
    const btn = document.querySelector('#movieList li button[title="Hide movie"]');
    btn.click();

    expect(document.querySelector('#movieList li')).toBeNull();
    expect(JSON.parse(hidden)).toEqual(['321']);
  });

  it('saves movie on save and posts to server', async () => {
    const dom = new JSDOM('<div id="movieList"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    window.tmdbApiKey = 'TEST_KEY';

    let saved = '[]';
    let watched = '[]';
    global.localStorage = {
      getItem: key => {
        if (key === 'savedMovieIds') return saved;
        if (key === 'watchedMovieIds') return watched;
        return '';
      },
      setItem: (key, value) => {
        if (key === 'savedMovieIds') saved = value;
        if (key === 'watchedMovieIds') watched = value;
      }
    };
    Object.defineProperty(window, 'localStorage', { value: global.localStorage });
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    Object.defineProperty(window, 'sessionStorage', { value: global.sessionStorage });

    const apiData = {
      results: [
        {
          id: 777,
          title: 'Save Me',
          release_date: '2024-01-01',
          poster_path: '/a.jpg',
          genre_ids: [],
          vote_count: 10
        }
      ]
    };
    const creditsData = { cast: [], crew: [] };
    const genreData = { genres: [] };

    const emptyPage = { results: [] };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(apiData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(creditsData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(genreData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'ok' }) });

    await initMoviesPanel();
    const saveButton = document.querySelector('#movieList li button[title="Save movie"]');
    saveButton.click();
    await new Promise(r => setTimeout(r, 0));

    expect(document.querySelector('#movieList li')).toBeNull();
    expect(fetch).toHaveBeenNthCalledWith(
      8,
      `${API_BASE_URL}/api/saved-movies`,
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(saved)).toEqual(['777']);
  });

  it('does not render movies already hidden', async () => {
    const dom = new JSDOM('<div id="movieList"></div>');
    global.document = dom.window.document;
    global.window = dom.window;
    window.tmdbApiKey = 'TEST_KEY';

    global.localStorage = {
      getItem: key => {
        if (key === 'hiddenMovieIds') return '["555"]';
        if (key === 'watchedMovieIds') return '[]';
        return '';
      },
      setItem: () => {}
    };
    Object.defineProperty(window, 'localStorage', { value: global.localStorage });
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    Object.defineProperty(window, 'sessionStorage', { value: global.sessionStorage });

    const apiData = {
      results: [
        {
          id: 555,
          title: 'Skip Me',
          release_date: '2024-01-01',
          genre_ids: [],
          poster_path: '/a.jpg',
          vote_count: 10
        }
      ]
    };
    const genreData = { genres: [] };

    const emptyPage = { results: [] };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(apiData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) });

    await initMoviesPanel();
    expect(document.querySelector('#movieList li')).toBeNull();
  });

  it('loads saved movies when Saved Movies tab clicked', async () => {
    const dom = new JSDOM(`
      <div id="movieTabs">
        <button class="movie-tab active" data-target="movieStreamSection">Movie Stream</button>
        <button class="movie-tab" data-target="savedMoviesSection">Saved Movies</button>
        <button class="movie-tab" data-target="watchedMoviesSection">Watched Movies</button>
      </div>
      <div id="movieStreamSection"><div id="movieList"></div></div>
      <div id="savedMoviesSection" style="display:none;"><div id="savedMoviesList"></div></div>
      <div id="watchedMoviesSection" style="display:none;"><div id="watchedMoviesList"></div></div>
    `);
    global.document = dom.window.document;
    global.window = dom.window;
    window.tmdbApiKey = 'TEST_KEY';
    global.localStorage = {
      getItem: () => '[]',
      setItem: () => {}
    };
    Object.defineProperty(window, 'localStorage', { value: global.localStorage });
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    Object.defineProperty(window, 'sessionStorage', { value: global.sessionStorage });

    const apiData = { results: [] };
    const genreData = { genres: [] };
    const savedMovies = [
      { id: 1, title: 'Saved One', release_date: '2023-01-01', poster_path: '/a.jpg' }
    ];

    global.fetch = vi.fn(url => {
      if (url.includes('discover/movie')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(apiData) });
      }
      if (url.includes('genre')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(genreData) });
      }
      if (url === `${API_BASE_URL}/api/saved-movies`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(savedMovies) });
      }
      return Promise.reject(new Error('unknown url'));
    });

    await initMoviesPanel();
    const savedTab = document.querySelector('#movieTabs button[data-target="savedMoviesSection"]');
    savedTab.click();
    await new Promise(r => setTimeout(r, 10));

    const savedListEl = document.getElementById('savedMoviesList');
    expect(savedListEl.textContent).toContain('Saved One');
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/saved-movies`);
  });

  it('loads watched movies when Watched Movies tab clicked', async () => {
    const dom = new JSDOM(`
      <div id="movieTabs">
        <button class="movie-tab active" data-target="movieStreamSection">Movie Stream</button>
        <button class="movie-tab" data-target="savedMoviesSection">Saved Movies</button>
        <button class="movie-tab" data-target="watchedMoviesSection">Watched Movies</button>
      </div>
      <div id="movieStreamSection"><div id="movieList"></div></div>
      <div id="savedMoviesSection" style="display:none;"><div id="savedMoviesList"></div></div>
      <div id="watchedMoviesSection" style="display:none;"><div id="watchedMoviesList"></div></div>
    `);
    global.document = dom.window.document;
    global.window = dom.window;
    window.tmdbApiKey = 'TEST_KEY';
    let watchedIds = '[]';
    let watchedData = '[]';
    global.localStorage = {
      getItem: key => {
        if (key === 'watchedMovieIds') return watchedIds;
        if (key === 'watchedMovieData') return watchedData;
        return '[]';
      },
      setItem: (key, value) => {
        if (key === 'watchedMovieIds') watchedIds = value;
        if (key === 'watchedMovieData') watchedData = value;
      }
    };
    Object.defineProperty(window, 'localStorage', { value: global.localStorage });
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    Object.defineProperty(window, 'sessionStorage', { value: global.sessionStorage });

    const apiData = {
      results: [
        {
          id: 9,
          title: 'Watch Me',
          release_date: '2024-01-01',
          poster_path: '/a.jpg',
          genre_ids: [],
          vote_count: 10
        }
      ]
    };
    const genreData = { genres: [] };
    const emptyPage = { results: [] };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(apiData) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyPage) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ cast: [], crew: [] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(genreData) });

    await initMoviesPanel();
    const watchBtn = document.querySelector(
      '#movieList li button[title="Mark watched"]'
    );
    watchBtn.click();
    await new Promise(r => setTimeout(r, 0));
    expect(JSON.parse(watchedIds)).toEqual(['9']);
    const watchedTab = document.querySelector(
      '#movieTabs button[data-target="watchedMoviesSection"]'
    );
    watchedTab.click();
    await new Promise(r => setTimeout(r, 0));
    const watchedListEl = document.getElementById('watchedMoviesList');
    expect(watchedListEl.textContent).toContain('Watch Me');
  });
});

