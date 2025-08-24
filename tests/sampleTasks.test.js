import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const mockDb = {
  collection: () => ({
    doc: () => ({
      get: () => Promise.resolve({ data: () => null, exists: false }),
      set: () => Promise.resolve(),
    }),
  }),
};

vi.mock('../js/auth.js', () => ({
  db: mockDb,
  currentUser: null,
  auth: { onAuthStateChanged: vi.fn() },
  awaitAuthUser: () => Promise.resolve(null),
  getCurrentUser: () => null,
}));

describe('sample routine tasks', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders sample tasks when signed out', async () => {
    const dom = new JSDOM('<div id="dailyPanel" style="display:flex"></div>', { url: 'https://example.com' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    global.Event = dom.window.Event;

    const { renderDailyTasks } = await import('../js/daily.js');
    await renderDailyTasks(null, mockDb);
    const wrappers = document.querySelectorAll('#dailyTasksList .daily-task-wrapper');
    expect(wrappers.length).toBeGreaterThan(0);
  });
});
