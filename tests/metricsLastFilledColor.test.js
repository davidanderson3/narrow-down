import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  getCurrentUser: () => null
}));

describe('metric background intensity', () => {
  it('uses orange intensity based on time since last entry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-10T12:00:00Z'));

    const dom = new JSDOM('<div id="genericStatsSummary"></div>', { url: 'https://example.org/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    const cfg = [
      { id: 'water', label: 'Water', unit: 'count', direction: 'higher' },
      { id: 'run', label: 'Run', unit: 'count', direction: 'higher' }
    ];
    window.localStorage.setItem('metricsConfig', JSON.stringify(cfg));

    const data = {
      '2024-01-10': { water: [{ value: 5, timestamp: Date.now() }] },
      '2024-01-07': { run: [{ value: 1, timestamp: new Date('2024-01-07T12:00:00Z').getTime() }] }
    };
    window.localStorage.setItem('metricsData', JSON.stringify(data));

    await import('../js/stats.js');
    await window._statsDebug.renderStatsSummary();

    const waterRow = document.querySelector('tr[data-metric-id="water"]');
    const runRow = document.querySelector('tr[data-metric-id="run"]');

    const waterAlpha = parseFloat((waterRow.style.backgroundColor.match(/rgba\(255, 165, 0, ([0-9.]+)\)/) || [0, '0'])[1]);
    expect(waterAlpha).toBeCloseTo(0, 5);
    const runAlpha = parseFloat(runRow.style.backgroundColor.match(/rgba\(255, 165, 0, ([0-9.]+)\)/)[1]);
    expect(runAlpha).toBeCloseTo(3 / 7, 2);
  });
});
