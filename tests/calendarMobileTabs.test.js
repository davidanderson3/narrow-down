import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(),
  saveDecisions: vi.fn(),
  generateId: vi.fn(),
  flushPendingDecisions: vi.fn().mockResolvedValue(),
  clearDecisionsCache: vi.fn(),
  pickDate: vi.fn()
}));
vi.mock('../js/daily.js', () => ({ renderDailyTasks: vi.fn() }));
vi.mock('../js/goals.js', () => ({
  renderGoalsAndSubitems: vi.fn(),
  addCalendarGoal: vi.fn()
}));
vi.mock('../js/auth.js', () => ({ initAuth: vi.fn(), db: {}, currentUser: null, auth: { onAuthStateChanged: vi.fn() } }));
vi.mock('../js/wizard.js', () => ({ initWizard: vi.fn() }));
vi.mock('../js/report.js', () => ({ renderDailyTaskReport: vi.fn() }));
vi.mock('../js/stats.js', () => ({ initMetricsUI: vi.fn() }));
vi.mock('../js/tabs.js', () => ({ initTabs: vi.fn() }));
vi.mock('../js/buttonStyles.js', () => ({ initButtonStyles: vi.fn() }));
vi.mock('../js/tabReports.js', () => ({ initTabReports: vi.fn() }));
vi.mock('../js/settings.js', () => ({ loadHiddenTabs: vi.fn(), applyHiddenTabs: vi.fn(), saveHiddenTabs: vi.fn() }));
vi.mock('../js/planning.js', () => ({ clearPlanningCache: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
});

describe('calendar mobile tabs', () => {
  function setupDom() {
    const dom = new JSDOM(`
      <div id="calendarPanel" class="main-layout">
        <div class="calendar-mobile-tabs">
          <button type="button" id="calendarDailyTab" class="calendar-mobile-tab active">Daily</button>
          <button type="button" id="calendarHourlyTab" class="calendar-mobile-tab">Hourly</button>
        </div>
      </div>
      <button id="signupBtn"></button>
      <button id="loginBtn"></button>
      <button id="bottomAddBtn"></button>
      <button class="tab-button" data-target="calendarPanel"></button>
    `, { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.firebase = { auth: () => ({ currentUser: null }) };
    return dom;
  }

  it('hides mobile tabs on wide screens', async () => {
    const dom = setupDom();
    dom.window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    const tabs = dom.window.document.querySelector('.calendar-mobile-tabs');
    expect(tabs.style.display).toBe('none');
  });

  it('shows mobile tabs on small screens', async () => {
    const dom = setupDom();
    dom.window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    await import('../js/main.js');
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    const tabs = dom.window.document.querySelector('.calendar-mobile-tabs');
    expect(tabs.style.display).not.toBe('none');
  });
});
