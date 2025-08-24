import { describe, it, expect, vi, beforeEach } from 'vitest';

const deleteMock = vi.fn();
const setMock = vi.fn();
const getMock = vi.fn();
let currentUser = null;

vi.mock('../js/auth.js', () => ({
  getCurrentUser: () => currentUser,
  auth: { onAuthStateChanged: vi.fn() },
  db: {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({ delete: deleteMock, set: setMock, get: getMock })
        })
      })
    })
  }
}));

const storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = storage;

beforeEach(() => {
  deleteMock.mockClear();
  setMock.mockClear();
  getMock.mockClear();
  currentUser = null;
  vi.resetModules();
  localStorage.clear();
});

describe('clearHiddenTabs', () => {
  it('clears localStorage for anonymous users', async () => {
    const { clearHiddenTabs } = await import('../js/settings.js');
    localStorage.setItem('hiddenTabs', JSON.stringify({ a: 'b' }));
    await clearHiddenTabs();
    expect(localStorage.getItem('hiddenTabs')).toBeNull();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('deletes Firestore doc for signed-in users', async () => {
    currentUser = { uid: 'u1' };
    const { clearHiddenTabs } = await import('../js/settings.js');
    localStorage.setItem('hiddenTabs-u1', JSON.stringify({ a: 'b' }));
    await clearHiddenTabs();
    expect(deleteMock).toHaveBeenCalled();
    expect(localStorage.getItem('hiddenTabs-u1')).toBeNull();
  });
});

describe('saveHiddenTabs', () => {
  it('overwrites hidden tabs for signed-in users', async () => {
    currentUser = { uid: 'u1' };
    const { saveHiddenTabs } = await import('../js/settings.js');
    await saveHiddenTabs({});
    expect(setMock.mock.calls[0]).toEqual([{ tabs: {} }]);
  });
});

describe('loadHiddenTabs', () => {
  it('defaults to localStorage for new users', async () => {
    currentUser = { uid: 'u1' };
    getMock.mockResolvedValue({ exists: false });
    const hidden = { calendarPanel: '9999-12-31T00:00:00.000Z' };
    localStorage.setItem('hiddenTabs-u1', JSON.stringify(hidden));
    const { loadHiddenTabs } = await import('../js/settings.js');
    const result = await loadHiddenTabs();
    expect(result).toEqual(hidden);
    expect(setMock).toHaveBeenCalledWith({ tabs: hidden });
  });

  it('uses Firestore data when available', async () => {
    currentUser = { uid: 'u1' };
    getMock.mockResolvedValue({ exists: true, data: () => ({ tabs: { a: 'b' } }) });
    const { loadHiddenTabs } = await import('../js/settings.js');
    const result = await loadHiddenTabs();
    expect(result).toEqual({ a: 'b' });
  });

  it('migrates legacy keys without uploading', async () => {
    currentUser = { uid: 'u1' };
    getMock.mockResolvedValue({ exists: false });
    const hidden = { calendarPanel: '9999-12-31T00:00:00.000Z' };
    localStorage.setItem('hiddenTabs', JSON.stringify(hidden));
    const { loadHiddenTabs } = await import('../js/settings.js');
    const result = await loadHiddenTabs();
    expect(result).toEqual(hidden);
    expect(setMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('hiddenTabs')).toBeNull();
    expect(localStorage.getItem('hiddenTabs-u1')).toEqual(JSON.stringify(hidden));
  });
});
