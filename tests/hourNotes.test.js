import { describe, it, expect, vi } from 'vitest';
vi.mock('../js/auth.js', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  getCurrentUser: () => null
}));
import { loadHourNotes } from '../js/hourNotes.js';

var storage = (() => {
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

describe('loadHourNotes', () => {
  it('shifts sample notes into the future when none stored', () => {
    localStorage.clear();
    const notes = loadHourNotes();
    const dates = Object.keys(notes);
    expect(dates.length).toBeGreaterThan(0);
    const first = new Date(dates.sort()[0]);
    expect(first.getTime()).toBeGreaterThan(Date.now());
  });
});
