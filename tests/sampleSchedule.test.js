import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  db: {},
  getCurrentUser: () => null
}));

describe('sample daily planner', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders sample items when signed out', async () => {
    const dom = new JSDOM('<div id="list"></div>', { url: 'https://example.org/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    const { renderTodaySchedule } = await import('../js/goals.js');
    renderTodaySchedule([], document.getElementById('list'), null);
    expect(document.querySelectorAll('.hour-note').length).toBeGreaterThan(0);
  });
});
