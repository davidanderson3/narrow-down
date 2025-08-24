import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  getCurrentUser: () => null
}));

describe('metrics reordering', () => {
  let dom;
  beforeEach(() => {
    dom = new JSDOM('<div id="genericStatsSummary"></div>', { url: 'https://example.org/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
  });

  it('moves metric up and persists order', async () => {
    const metrics = [
      { id: 'a', label: 'A', unit: 'count', direction: 'higher' },
      { id: 'b', label: 'B', unit: 'count', direction: 'higher' }
    ];
    window.localStorage.setItem('metricsConfig', JSON.stringify(metrics));
    window.localStorage.setItem('metricsData', JSON.stringify({ today: {} }));

    await import('../js/stats.js');
    await window._statsDebug.renderStatsSummary();

    const tbody = document.querySelector('#genericStatsSummary tbody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows[0].querySelector('td').textContent).toBe('A');
    expect(rows[1].querySelector('td').textContent).toBe('B');

    const upBtn = rows[1].querySelector('button');
    upBtn.click();

    const reordered = tbody.querySelectorAll('tr');
    expect(reordered[0].querySelector('td').textContent).toBe('B');
    expect(reordered[1].querySelector('td').textContent).toBe('A');

    const stored = JSON.parse(window.localStorage.getItem('metricsConfig'));
    expect(stored.map(m => m.id)).toEqual(['b', 'a']);
  });
});
