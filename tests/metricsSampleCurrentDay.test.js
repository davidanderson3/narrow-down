import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  getCurrentUser: () => null
}));

describe('sample metrics current day', () => {
  it('adds today values when signed out', async () => {
    const dom = new JSDOM('', { url: 'https://example.org/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    await import('../js/stats.js');
    const data = await window._statsDebug.loadAllStats();
    const today = new Date().toISOString().split('T')[0];
    expect(Object.prototype.hasOwnProperty.call(data, today)).toBe(true);
  });
});
