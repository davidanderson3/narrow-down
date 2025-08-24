export const API_BASE_URL =
  (typeof window !== 'undefined' && window.apiBaseUrl) ||
  (typeof process !== 'undefined' && process.env.API_BASE_URL) ||
  'https://dashboard-6aih.onrender.com';

function makeIconBtn(symbol, title, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = symbol;
  b.title = title;
  Object.assign(b.style, {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1em',
    padding: '0',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    verticalAlign: 'middle'
  });
  b.addEventListener('mousedown', e => e.stopPropagation());
  b.addEventListener('click', e => e.stopPropagation());
  b.onclick = fn;
  return b;
}

function humanizeKey(str) {
  return String(str)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function appendMeta(metaList, label, value) {
  const mi = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  mi.append(strong, ` ${value}`);
  metaList.appendChild(mi);
}

export async function initMoviesPanel() {
  const listEl = document.getElementById('movieList');
  if (!listEl) return;
  const savedListEl = document.getElementById('savedMoviesList');
  const movieTabs = document.getElementById('movieTabs');
  const streamSection = document.getElementById('movieStreamSection');
  const savedSection = document.getElementById('savedMoviesSection');
  const watchedListEl = document.getElementById('watchedMoviesList');
  const watchedSection = document.getElementById('watchedMoviesSection');
  const apiKeyInput = document.getElementById('moviesApiKey');
  const apiKeyContainer = document.getElementById('moviesApiKeyContainer');

  const hiddenKey = 'hiddenMovieIds';
  const savedKey = 'savedMovieIds';
  const watchedKey = 'watchedMovieIds';
  const watchedDataKey = 'watchedMovieData';

  const getHidden = () => {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(hiddenKey);
      return new Set(
        (stored ? JSON.parse(stored) : []).map(id => String(id))
      );
    } catch (_) {
      return new Set();
    }
  };

  const saveHidden = ids => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(hiddenKey, JSON.stringify(Array.from(ids)));
    } catch (_) {
      /* ignore */
    }
  };

  const getSaved = () => {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(savedKey);
      return new Set(
        (stored ? JSON.parse(stored) : []).map(id => String(id))
      );
    } catch (_) {
      return new Set();
    }
  };

  const saveSaved = ids => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(savedKey, JSON.stringify(Array.from(ids)));
    } catch (_) {
      /* ignore */
    }
  };

  const getWatched = () => {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(watchedKey);
      return new Set(
        (stored ? JSON.parse(stored) : []).map(id => String(id))
      );
    } catch (_) {
      return new Set();
    }
  };

  const saveWatched = ids => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(watchedKey, JSON.stringify(Array.from(ids)));
    } catch (_) {
      /* ignore */
    }
  };

  const getWatchedData = () => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(watchedDataKey);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  };

  const saveWatchedData = data => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(watchedDataKey, JSON.stringify(data));
    } catch (_) {
      /* ignore */
    }
  };

  const loadSavedMovies = async () => {
    if (!savedListEl) return;
    savedListEl.innerHTML = '<em>Loading...</em>';
    try {
      const watched = getWatched();
      const res = await fetch(`${API_BASE_URL}/api/saved-movies`);
      if (!res.ok) throw new Error('Network response was not ok');
      let movies = await res.json();
      movies = movies.filter(m => !watched.has(String(m.id)));
      if (!movies.length) {
        savedListEl.innerHTML = '<em>No saved movies.</em>';
        return;
      }
      const ul = document.createElement('ul');
      movies.forEach(m => {
        const li = document.createElement('li');
        li.className = 'movie-card';
        const title = (m.title || m.name || '').trim();
        const year = (m.release_date || '').split('-')[0] || 'Unknown';
        if (m.poster_path) {
          const img = document.createElement('img');
          img.src = `https://image.tmdb.org/t/p/w200${m.poster_path}`;
          img.alt = `${title} poster`;
          li.appendChild(img);
        }
        const info = document.createElement('div');
        info.className = 'movie-info';
        const titleEl = document.createElement('h3');
        titleEl.textContent = `${title} (${year})`;
        info.appendChild(titleEl);
        const metaList = document.createElement('ul');
        metaList.className = 'movie-meta';
        if (m.director) {
          appendMeta(metaList, 'Director', m.director);
        }
        if (m.actors) {
          appendMeta(metaList, 'Actors', m.actors);
        }
        if (m.overview) {
          const mi = document.createElement('li');
          mi.textContent = `${m.overview}`;
          metaList.appendChild(mi);
        }
        if (metaList.childNodes.length) info.appendChild(metaList);
        li.appendChild(info);
        ul.appendChild(li);
      });
      savedListEl.innerHTML = '';
      savedListEl.appendChild(ul);
    } catch (err) {
      console.error('Failed to load saved movies', err);
      savedListEl.textContent = 'Failed to load saved movies.';
    }
  };

  const loadWatchedMovies = () => {
    if (!watchedListEl) return;
    const movies = getWatchedData();
    if (!movies.length) {
      watchedListEl.innerHTML = '<em>No watched movies.</em>';
      return;
    }
    const ul = document.createElement('ul');
    movies.forEach(m => {
      const li = document.createElement('li');
      li.className = 'movie-card';
      const title = (m.title || m.name || '').trim();
      const year = (m.release_date || '').split('-')[0] || 'Unknown';
      if (m.poster_path) {
        const img = document.createElement('img');
        img.src = `https://image.tmdb.org/t/p/w200${m.poster_path}`;
        img.alt = `${title} poster`;
        li.appendChild(img);
      }
      const info = document.createElement('div');
      info.className = 'movie-info';
      const titleEl = document.createElement('h3');
      titleEl.textContent = `${title} (${year})`;
      info.appendChild(titleEl);
      const metaList = document.createElement('ul');
      metaList.className = 'movie-meta';
      if (m.director) {
        appendMeta(metaList, 'Director', m.director);
      }
      if (m.actors) {
        appendMeta(metaList, 'Actors', m.actors);
      }
      if (m.overview) {
        const mi = document.createElement('li');
        mi.textContent = `${m.overview}`;
        metaList.appendChild(mi);
      }
      if (metaList.childNodes.length) info.appendChild(metaList);
      li.appendChild(info);
      ul.appendChild(li);
    });
    watchedListEl.innerHTML = '';
    watchedListEl.appendChild(ul);
  };

  const savedApiKey =
    (typeof localStorage !== 'undefined' && localStorage.getItem('moviesApiKey')) || '';
  if (apiKeyInput) apiKeyInput.value = savedApiKey;
  if (savedApiKey && apiKeyContainer) apiKeyContainer.style.display = 'none';

  let currentApiKey =
    (typeof window !== 'undefined' && window.tmdbApiKey) ||
    (typeof process !== 'undefined' && process.env.TMDB_API_KEY) ||
    savedApiKey ||
    '';

  const loadMovies = async () => {
    const apiKey = currentApiKey || apiKeyInput?.value.trim();
    if (!apiKey) {
      listEl.textContent = 'TMDB API key not provided.';
      return;
    }

    if (!currentApiKey) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('moviesApiKey', apiKey);
      }
      if (typeof window !== 'undefined') {
        window.tmdbApiKey = apiKey;
      }
    }

    listEl.innerHTML = '<em>Loading...</em>';
    try {
      const hidden = getHidden();
      const saved = getSaved();
      const watched = getWatched();

      // Fetch 100 movies sorted by vote count descending
      const moviesData = [];
      for (let page = 1; page <= 5 && moviesData.length < 100; page++) {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&sort_by=release_date.desc&page=${page}`;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('Network response was not ok');
          const data = await res.json();
          moviesData.push(...(data.results || []));
        } catch (_) {
          // ignore individual page fetch errors
        }
      }

      const movies = moviesData
        .slice(0, 100)
        .filter(
          m =>
            m.vote_count >= 10 &&
            !hidden.has(String(m.id)) &&
            !saved.has(String(m.id)) &&
            !watched.has(String(m.id))
        )
        .sort(
          (a, b) =>
            new Date(b.release_date || 0) - new Date(a.release_date || 0) ||
            b.vote_average - a.vote_average ||
            b.popularity - a.popularity
        );
      if (movies.length === 0) {
        listEl.textContent = 'No movies found.';
        return;
      }

      // Fetch cast and crew for each movie
      await Promise.all(
        movies.map(async m => {
          try {
            const creditUrl = `https://api.themoviedb.org/3/movie/${m.id}/credits?api_key=${apiKey}`;
            const creditRes = await fetch(creditUrl);
            if (creditRes.ok) {
              const creditData = await creditRes.json();
              m.actors = (creditData.cast || [])
                .slice(0, 5)
                .map(c => c.name)
                .join(', ');
              const director = (creditData.crew || []).find(c => c.job === 'Director');
              if (director) m.director = director.name;
            }
          } catch (_) {
            /* ignore credit fetch errors */
          }
        })
      );

      // Fetch genre list to map IDs to names
      let genreMap = {};
      try {
        const genreUrl = `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`;
        const genreRes = await fetch(genreUrl);
        if (genreRes.ok) {
          const genreData = await genreRes.json();
          genreMap = Object.fromEntries(
            (genreData.genres || []).map(g => [g.id, g.name])
          );
        }
      } catch (_) {
        // ignore genre fetch errors
      }

      const exclude = new Set([
        'adult',
        'backdrop_path',
        'id',
        'original_title',
        'poster_path',
        'title',
        'actors',
        'director'
      ]);
      const ul = document.createElement('ul');
      movies.forEach(m => {
        const li = document.createElement('li');
        li.className = 'movie-card';
        const title = (m.title || m.name || '').trim();
        const year = (m.release_date || '').split('-')[0] || 'Unknown';

        if (m.poster_path) {
          const img = document.createElement('img');
          img.src = `https://image.tmdb.org/t/p/w200${m.poster_path}`;
          img.alt = `${title} poster`;
          li.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'movie-info';

        const titleEl = document.createElement('h3');
        titleEl.textContent = `${title} (${year})`;
        info.appendChild(titleEl);

        const btnRow = document.createElement('div');
        btnRow.className = 'button-row';

      const saveBtn = makeIconBtn('💾', 'Save movie', async () => {
        saved.add(String(m.id));
        saveSaved(saved);
        try {
          await fetch(`${API_BASE_URL}/api/saved-movies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m)
          });
        } catch (_) {
          /* ignore */
        }
        li.remove();
        if (savedSection && savedSection.style.display !== 'none') {
          loadSavedMovies();
        }
      });

        const watchedBtn = makeIconBtn('👁️', 'Mark watched', () => {
          watched.add(String(m.id));
          saveWatched(watched);
          const data = getWatchedData();
          if (!data.some(w => String(w.id) === String(m.id))) {
            data.push(m);
            saveWatchedData(data);
          }
          li.remove();
          if (watchedSection && watchedSection.style.display !== 'none') {
            loadWatchedMovies();
          }
        });

        const hideBtn = makeIconBtn('❌', 'Hide movie', () => {
          hidden.add(String(m.id));
          saveHidden(hidden);
          li.remove();
        });

        btnRow.append(saveBtn, watchedBtn, hideBtn);
        info.appendChild(btnRow);

        const metaList = document.createElement('ul');
        metaList.className = 'movie-meta';

        if (m.director) {
          appendMeta(metaList, 'Director', m.director);
        }
        if (m.actors) {
          appendMeta(metaList, 'Actors', m.actors);
        }

        Object.entries(m).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          if (exclude.has(key)) return;
          if (key === 'genre_ids') {
            const names = (value || [])
              .map(id => genreMap[id])
              .filter(Boolean);
            const display = names.length ? names.join(', ') : (value || []).join(', ');
            appendMeta(metaList, 'Genres', display);
          } else if (key === 'overview') {
            const mi = document.createElement('li');
            mi.textContent = `${value}`;
            metaList.appendChild(mi);
          } else {
            const label = humanizeKey(key);
            const val =
              typeof value === 'object' ? JSON.stringify(value) : value;
            appendMeta(metaList, label, val);
          }
        });
        if (metaList.childNodes.length) info.appendChild(metaList);

        li.appendChild(info);
        ul.appendChild(li);
      });

      listEl.innerHTML = '';
      listEl.appendChild(ul);
      if (!currentApiKey) {
        currentApiKey = apiKey;
        if (apiKeyContainer) apiKeyContainer.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load movies', err);
      listEl.textContent = 'Failed to load movies.';
    }
  };

  apiKeyInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      loadMovies();
    }
  });
  apiKeyInput?.addEventListener('change', loadMovies);
  await loadMovies();

  if (movieTabs) {
    const buttons = movieTabs.querySelectorAll('.movie-tab');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.target;
        streamSection &&
          (streamSection.style.display =
            target === 'movieStreamSection' ? '' : 'none');
        savedSection &&
          (savedSection.style.display =
            target === 'savedMoviesSection' ? '' : 'none');
        watchedSection &&
          (watchedSection.style.display =
            target === 'watchedMoviesSection' ? '' : 'none');
        if (target === 'savedMoviesSection') {
          loadSavedMovies();
        } else if (target === 'watchedMoviesSection') {
          loadWatchedMovies();
        }
      });
    });
  }
}

if (typeof window !== 'undefined') {
  window.initMoviesPanel = initMoviesPanel;
}

