import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  getCurrentUser: () => null
}));

describe('metrics postpone button', () => {
  let dom;
  beforeEach(() => {
    dom = new JSDOM('<div id="genericStatsSummary"></div>', { url: 'https://example.org/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
  });

  it('has left margin like other icons', async () => {
    const metrics = [
      { id: 'a', label: 'A', unit: 'count', direction: 'higher' }
    ];
    window.localStorage.setItem('metricsConfig', JSON.stringify(metrics));
    window.localStorage.setItem('metricsData', JSON.stringify({ today: {} }));

    await import('../js/stats.js');
    await window._statsDebug.renderStatsSummary();

    const clockBtn = document.querySelector('button[title="Postpone"]');
    expect(clockBtn).toBeTruthy();
    expect(clockBtn.style.marginLeft).toBe('8px');
  });
});
