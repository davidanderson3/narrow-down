import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  getCurrentUser: () => null
}));

describe('metrics sorting by last completion', () => {
  it('lists metrics with the oldest completion first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-10T12:00:00Z'));

    const dom = new JSDOM('<div id="genericStatsSummary"></div>', { url: 'https://example.org/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    const cfg = [
      { id: 'recent', label: 'Recent', unit: 'count', direction: 'higher' },
      { id: 'old', label: 'Old', unit: 'count', direction: 'higher' },
      { id: 'never', label: 'Never', unit: 'count', direction: 'higher' }
    ];
    window.localStorage.setItem('metricsConfig', JSON.stringify(cfg));

    const data = {
      '2024-01-10': { recent: [{ value: 1, timestamp: new Date('2024-01-10T12:00:00Z').getTime() }] },
      '2023-12-31': { old: [{ value: 1, timestamp: new Date('2023-12-31T12:00:00Z').getTime() }] }
    };
    window.localStorage.setItem('metricsData', JSON.stringify(data));

    await import('../js/stats.js');
    await window._statsDebug.renderStatsSummary();

    const rows = [...document.querySelectorAll('#genericStatsSummary tbody tr')];
    const labels = rows.map(r => r.querySelector('td').textContent);
    expect(labels).toEqual(['Never', 'Old', 'Recent']);
  });
});
