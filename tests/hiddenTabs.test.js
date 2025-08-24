import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {}, auth: { onAuthStateChanged: vi.fn() } }));
vi.mock('../js/tabs.js', () => ({ PANELS: [], PANEL_NAMES: {} }));
vi.mock('../js/siteName.js', () => ({ getSiteName: () => '', setSiteName: vi.fn() }));

describe('hidden tabs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('reappear after hide duration expires', async () => {
    const dom = new JSDOM(`<button class="tab-button" data-target="tab1"></button><div id="tab1"></div>`, { url: 'https://example.com' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    const { saveHiddenTabs, loadHiddenTabs, applyHiddenTabs } = await import('../js/settings.js');

    const hideUntil = new Date(Date.now() + 1000).toISOString();
    await saveHiddenTabs({ tab1: hideUntil });
    applyHiddenTabs(await loadHiddenTabs());

    expect(document.querySelector('.tab-button').style.display).toBe('none');

    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector('.tab-button').style.display).toBe('');
  });
});
