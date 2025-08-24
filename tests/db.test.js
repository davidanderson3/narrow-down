import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMock = vi.fn();
const updateMock = vi.fn();
const getMock = vi.fn();
const realWarn = console.warn;

// Simple localStorage mock for Node environment
const storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();
global.localStorage = storage;

vi.mock('../js/auth.js', () => {
  return {
    getCurrentUser: () => ({ uid: 'user1' }),
    awaitAuthUser: () => Promise.resolve(),
    auth: { onAuthStateChanged: vi.fn() },
    db: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: getMock,
          set: setMock,
          update: updateMock
        }))
      }))
    }
  };
});

beforeEach(() => {
  setMock.mockClear();
  updateMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  vi.doMock('../js/auth.js', () => ({
    getCurrentUser: () => ({ uid: 'user1' }),
    awaitAuthUser: () => Promise.resolve(),
    auth: { onAuthStateChanged: vi.fn() },
    db: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ get: getMock, set: setMock, update: updateMock }))
      }))
    }
  }));
  localStorage.clear();
  console.warn = realWarn;
});

describe('database helpers', () => {
  it('loads decisions from Firestore', async () => {
    getMock.mockResolvedValue({ data: () => ({ items: [{ id: '1', text: 't' }] }) });
    const { loadDecisions } = await import('../js/helpers.js');
    const result = await loadDecisions(true);
    expect(result).toEqual([{ id: '1', text: 't' }]);
    expect(getMock).toHaveBeenCalled();
  });

  it('ignores sample decisions returned from Firestore', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');
    getMock.mockResolvedValue({ data: () => ({ items: SAMPLE_DECISIONS }) });
    const { loadDecisions } = await import('../js/helpers.js');
    const result = await loadDecisions(true);
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('converts Timestamp hiddenUntil values to strings', async () => {
    const future = new Date(Date.now() + 3600 * 1000);
    const tsObj = { toDate: () => future };
    getMock.mockResolvedValue({ data: () => ({ items: [{ id: 'g1', text: 't', hiddenUntil: tsObj }] }) });
    const { loadDecisions } = await import('../js/helpers.js');
    const result = await loadDecisions(true);
    expect(typeof result[0].hiddenUntil).toBe('string');
    const hideUntil = Date.parse(result[0].hiddenUntil) || 0;
    expect(hideUntil).toBeGreaterThan(Date.now());
  });

  it('retains decisions sharing text and type when loading', async () => {
    const items = [
      { id: '1', type: 'task', text: 'Repeat' },
      { id: '2', type: 'task', text: 'repeat' },
      { id: '3', type: 'goal', text: 'Repeat' }
    ];
    getMock.mockResolvedValue({ data: () => ({ items }) });
    const { loadDecisions } = await import('../js/helpers.js');
    const result = await loadDecisions(true);
    expect(result).toEqual(items);
  });

  it('saves decisions to Firestore', async () => {
    const items = [{ id: 'a', text: 'b' }];
    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    await saveDecisions(items);
    expect(setMock).not.toHaveBeenCalled();
    await flushPendingDecisions();
    expect(setMock).toHaveBeenCalledWith({ items }, { merge: true });
  });

  it('saves decisions with same text and type', async () => {
    const items = [
      { id: '1', type: 'task', text: 'Repeat' },
      { id: '2', type: 'task', text: 'repeat' },
      { id: '3', type: 'goal', text: 'Repeat' }
    ];
    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    await saveDecisions(items);
    await flushPendingDecisions();
    expect(setMock).toHaveBeenCalledWith(
      {
        items
      },
      { merge: true }
    );
  });

  it('saves goal order', async () => {
    const { saveGoalOrder } = await import('../js/helpers.js');
    await saveGoalOrder(['a', 'b']);
    expect(setMock).toHaveBeenCalledWith({ goalOrder: ['a', 'b'] }, { merge: true });
  });

  it('ignores empty decisions array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([]);
    expect(setMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores invalid decision objects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ foo: 'bar' }]);
    expect(setMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignores empty goal order', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveGoalOrder } = await import('../js/helpers.js');
    await saveGoalOrder([]);
    expect(setMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('alerts when saveDecisions fails', async () => {
    setMock.mockRejectedValueOnce(new Error('fail'));
    const alertSpy = vi.fn();
    global.alert = alertSpy;
    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ id: 'a', text: 'b' }]);
    await flushPendingDecisions();
    expect(alertSpy).toHaveBeenCalled();
  });

  it('alerts when saveGoalOrder fails', async () => {
    setMock.mockRejectedValueOnce(new Error('fail'));
    const alertSpy = vi.fn();
    global.alert = alertSpy;
    const { saveGoalOrder } = await import('../js/helpers.js');
    await saveGoalOrder(['a']);
    expect(alertSpy).toHaveBeenCalled();
  });

  it('alerts when not signed in', async () => {
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => null,
      awaitAuthUser: () => Promise.resolve(),
      db: { collection: () => ({ doc: () => ({ set: vi.fn() }) }) },
      auth: { onAuthStateChanged: cb => { setTimeout(() => cb(null), 0); return () => {}; } }
    }));
    const alertSpy = vi.fn();
    global.alert = alertSpy;
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ id: 'x', text: 'y' }]);
    expect(alertSpy).toHaveBeenCalled();
  });

  it('saves lists for anonymous users to localStorage', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, awaitAuthUser: () => Promise.resolve(), db: {}, auth: { onAuthStateChanged: vi.fn() } }));
    const { saveLists: saveAnon } = await import('../js/helpers.js');
    await saveAnon([{ name: 'test' }]);
    expect(JSON.parse(localStorage.getItem('myLists'))).toEqual([{ name: 'test' }]);
  });

  it('does not persist sample lists', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { saveLists } = await import('../js/helpers.js');
    const { SAMPLE_LISTS } = await import('../js/sampleData.js');
    await saveLists(SAMPLE_LISTS);
    expect(setMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns sample decisions for anonymous users', async () => {
    const dbMock = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ get: vi.fn(() => Promise.resolve({ data: () => undefined })) }))
      }))
    };
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => null,
      awaitAuthUser: () => Promise.resolve(),
      db: dbMock,
      auth: { onAuthStateChanged: vi.fn() }
    }));
    const { loadDecisions } = await import('../js/helpers.js');
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');
    const result = await loadDecisions(true);
    expect(result.length).toBe(SAMPLE_DECISIONS.length);
    result.filter(i => i.scheduled).forEach(i => {
      expect(new Date(i.scheduled).getTime()).toBeGreaterThan(Date.now());
    });
    expect(dbMock.collection).toHaveBeenCalledWith('sample');
  });
  it('debounces rapid saveDecisions calls', async () => {
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => ({ uid: 'user1' }),
      awaitAuthUser: () => Promise.resolve(),
      db: {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: getMock,
            set: setMock,
            update: updateMock
          }))
        }))
      },
      auth: { onAuthStateChanged: vi.fn() }
    }));
    const itemsA = [{ id: 'a', text: 'A' }];
    const itemsB = [{ id: 'b', text: 'B' }];
    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    await saveDecisions(itemsA);
    await saveDecisions(itemsB);
    expect(setMock).not.toHaveBeenCalled();
    await flushPendingDecisions();
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith({ items: itemsB }, { merge: true });
  });

  it('does not save sample dataset after login', async () => {
    const authCallbacks = [];
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => null,
      awaitAuthUser: () => Promise.resolve(),
      db: {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: getMock,
            set: setMock,
            update: updateMock
          }))
        }))
      },
      auth: { onAuthStateChanged: vi.fn(cb => { authCallbacks.push(cb); return () => {}; }) }
    }));
    const { saveDecisions, flushPendingDecisions } = await import('../js/helpers.js');
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');
    await saveDecisions(SAMPLE_DECISIONS);
    authCallbacks.forEach(cb => cb({ uid: 'user1' }));
    await flushPendingDecisions();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('ignores anonymous demo edits after login', async () => {
    const authCallbacks = [];
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => null,
      awaitAuthUser: () => Promise.resolve(),
      db: {
        collection: vi.fn(name => ({
          doc: vi.fn(() => ({
            set: data => {
              if (name === 'decisions') setMock(data);
              return Promise.resolve();
            }
          }))
        }))
      },
      auth: { onAuthStateChanged: vi.fn(cb => { authCallbacks.push(cb); return () => {}; }) }
    }));
    const { saveDecisions } = await import('../js/helpers.js');
    const demoItem = { id: 'demo-task-1', text: 'edited demo' };
    const realItem = { id: 'real-1', text: 'real task' };
    await saveDecisions([demoItem, realItem]);
    authCallbacks.forEach(cb => cb({ uid: 'user1' }));
    expect(setMock).not.toHaveBeenCalled();
  });

  it('persists anonymous edits across reloads', async () => {
    const sampleStore = {};
    const dbMock = {
      collection: vi.fn(name => ({
        doc: vi.fn(id => ({
          set: data => {
            if (name === 'sample') sampleStore[id] = data;
            return Promise.resolve();
          },
          get: () => Promise.resolve({ data: () => sampleStore[id] })
        }))
      }))
    };
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => null,
      awaitAuthUser: () => Promise.resolve(),
      db: dbMock,
      auth: { onAuthStateChanged: vi.fn() }
    }));
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ id: '1', text: 'a' }]);
    const sessionId = localStorage.getItem('sampleSessionId');
    expect(sampleStore[sessionId]).toEqual({ items: [{ id: '1', text: 'a' }] });

    vi.resetModules();
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => null,
      awaitAuthUser: () => Promise.resolve(),
      db: dbMock,
      auth: { onAuthStateChanged: vi.fn() }
    }));
    const { loadDecisions } = await import('../js/helpers.js');
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');
    const loaded = await loadDecisions(true);
    expect(loaded.length).toBe(SAMPLE_DECISIONS.length + 1);
    expect(loaded.some(i => i.id === '1' && i.text === 'a')).toBe(true);
  });

  it('does not write anonymous edits to user document after login', async () => {
    const authCallbacks = [];
    const dbMock = {
      collection: vi.fn(name => ({
        doc: vi.fn(id => ({
          set: data => {
            if (name === 'decisions') setMock(data);
            return Promise.resolve();
          },
          get: () => Promise.resolve({ data: () => undefined })
        }))
      }))
    };
    vi.doMock('../js/auth.js', () => ({
      getCurrentUser: () => null,
      awaitAuthUser: () => Promise.resolve(),
      db: dbMock,
      auth: { onAuthStateChanged: vi.fn(cb => { authCallbacks.push(cb); return () => {}; }) }
    }));
    const { saveDecisions } = await import('../js/helpers.js');
    await saveDecisions([{ id: 'a', text: 'b' }]);
    authCallbacks.forEach(cb => cb({ uid: 'user1' }));
    expect(setMock).not.toHaveBeenCalled();
  });

  it('removes duplicate decisions in Firestore', async () => {
    const items = [
      { id: '1', type: 'task', text: 'Repeat' },
      { id: '2', type: 'task', text: 'Repeat' },
      { id: '1', type: 'task', text: 'Repeat' },
      { id: '3', type: 'goal', text: 'Repeat' }
    ];
    getMock.mockResolvedValue({ data: () => ({ items }) });
    const { removeDuplicateDecisionsFromDb } = await import('../js/helpers.js');
    const result = await removeDuplicateDecisionsFromDb();
    expect(result).toEqual([
      { id: '1', type: 'task', text: 'Repeat' },
      { id: '3', type: 'goal', text: 'Repeat' }
    ]);
    expect(setMock).toHaveBeenCalledWith(
      { items: [
        { id: '1', type: 'task', text: 'Repeat' },
        { id: '3', type: 'goal', text: 'Repeat' }
      ] },
      { merge: true }
    );
  });

  it('trims whitespace when deduping decisions', async () => {
    const items = [
      { id: '1', type: 'task', text: 'Repeat' },
      { id: '2', type: 'task', text: 'Repeat ' },
      { id: '3', type: 'task', text: ' repeat' },
      { id: '4', type: 'goal', text: 'Repeat' }
    ];
    getMock.mockResolvedValue({ data: () => ({ items }) });
    const { removeDuplicateDecisionsFromDb } = await import('../js/helpers.js');
    const result = await removeDuplicateDecisionsFromDb();
    expect(result).toEqual([
      { id: '1', type: 'task', text: 'Repeat' },
      { id: '4', type: 'goal', text: 'Repeat' }
    ]);
    expect(setMock).toHaveBeenCalledWith(
      { items: [
        { id: '1', type: 'task', text: 'Repeat' },
        { id: '4', type: 'goal', text: 'Repeat' }
      ] },
      { merge: true }
    );
  });
});

