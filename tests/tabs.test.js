import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/auth.js', () => ({ currentUser: null, auth: { onAuthStateChanged: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
});

describe('initTabs persistence', () => {
  it('activates the last selected panel from localStorage', async () => {
    const dom = new JSDOM(`
      <button class="tab-button" data-target="projectsPanel"></button>
      <button class="tab-button" data-target="calendarPanel"></button>
      <button class="tab-button" data-target="dailyPanel"></button>
      <button class="tab-button" data-target="metricsPanel"></button>
      <button class="tab-button" data-target="listsPanel"></button>
      <button class="tab-button" data-target="travelPanel"></button>
      <button class="tab-button" data-target="planningPanel"></button>
      <button class="tab-button" data-target="budgetPanel"></button>
      <button class="tab-button" data-target="backupsPanel"></button>
      <button class="tab-button" data-target="geolayersPanel"></button>
      <div id="projectsPanel"></div>
      <div id="calendarPanel"></div>
      <div id="dailyPanel"></div>
      <div id="metricsPanel"></div>
      <div id="listsPanel"></div>
      <div id="travelPanel"></div>
      <div id="planningPanel"></div>
      <div id="budgetPanel"></div>
      <div id="backupsPanel"></div>
      <div id="geolayersPanel"></div>
    `, { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;

    const storage = (() => {
      let store = {};
      return {
        getItem: key => (key in store ? store[key] : null),
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: key => { delete store[key]; },
        clear: () => { store = {}; }
      };
    })();
    global.localStorage = storage;

    localStorage.setItem('lastPanel', 'dailyPanel');

    global.window.renderDailyTasks = vi.fn();
    global.window.initMetricsUI = vi.fn();
    global.window.initListsPanel = vi.fn();
    global.window.initTravelPanel = vi.fn();
    global.window.initPlanningPanel = vi.fn();
    global.window.initBackupsPanel = vi.fn();

    const mod = await import('../js/tabs.js');
    await mod.initTabs(null, {});
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const dailyBtn = document.querySelector('.tab-button[data-target="dailyPanel"]');
    expect(dailyBtn.classList.contains('active')).toBe(true);
    expect(document.getElementById('dailyPanel').style.display).toBe('flex');
  });

  it('ignores backupsPanel as initial when signed out', async () => {
    const dom = new JSDOM(`
      <button class="tab-button" data-target="projectsPanel"></button>
      <button class="tab-button" data-target="dailyPanel"></button>
      <button class="tab-button" data-target="backupsPanel"></button>
      <div id="projectsPanel"></div>
      <div id="dailyPanel"></div>
      <div id="backupsPanel"></div>
    `, { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;

    global.localStorage = {
      getItem: () => 'backupsPanel',
      setItem: () => {}
    };

    global.window.initBackupsPanel = vi.fn();

    const mod = await import('../js/tabs.js');
    await mod.initTabs(null, {});
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const active = document.querySelector('.tab-button.active');
    expect(active.dataset.target).toBe('dailyPanel');
    expect(window.initBackupsPanel).not.toHaveBeenCalled();
  });

  it('ignores geolayersPanel as initial when signed out', async () => {
    const dom = new JSDOM(`
      <button class="tab-button" data-target="projectsPanel"></button>
      <button class="tab-button" data-target="dailyPanel"></button>
      <button class="tab-button" data-target="geolayersPanel"></button>
      <div id="projectsPanel"></div>
      <div id="dailyPanel"></div>
      <div id="geolayersPanel"></div>
    `, { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;

    global.localStorage = {
      getItem: () => 'geolayersPanel',
      setItem: () => {}
    };

    const mod = await import('../js/tabs.js');
    await mod.initTabs(null, {});
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

    const active = document.querySelector('.tab-button.active');
    expect(active.dataset.target).toBe('dailyPanel');
  });
});

describe('routine tab behavior', () => {
  it('clears stale tasks before rendering new ones', async () => {
    const dom = new JSDOM(`
      <button class="tab-button active" data-target="projectsPanel"></button>
      <button class="tab-button" data-target="calendarPanel"></button>
      <button class="tab-button" data-target="dailyPanel"></button>
      <button class="tab-button" data-target="metricsPanel"></button>
      <button class="tab-button" data-target="listsPanel"></button>
      <button class="tab-button" data-target="travelPanel"></button>
      <button class="tab-button" data-target="planningPanel"></button>
      <button class="tab-button" data-target="budgetPanel"></button>
      <button class="tab-button" data-target="backupsPanel"></button>
      <button class="tab-button" data-target="geolayersPanel"></button>
      <div id="projectsPanel"></div>
      <div id="calendarPanel"></div>
      <div id="dailyPanel" style="display:none;">
        <div id="dailyTasksList"><div class="old">old</div></div>
      </div>
      <div id="metricsPanel"></div>
      <div id="listsPanel"></div>
      <div id="travelPanel"></div>
      <div id="planningPanel"></div>
      <div id="budgetPanel"></div>
      <div id="backupsPanel"></div>
      <div id="geolayersPanel"></div>
    `, { url: 'http://localhost/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.history = dom.window.history;
    global.localStorage = {
      getItem: () => null,
      setItem: () => {}
    };

    let resolve;
    const renderStub = vi.fn(() => new Promise(r => { resolve = r; }));
    global.window.renderDailyTasks = renderStub;
    global.window.initMetricsUI = vi.fn();
    global.window.initListsPanel = vi.fn();
    global.window.initTravelPanel = vi.fn();
    global.window.initPlanningPanel = vi.fn();
    global.window.initBudgetPanel = vi.fn();
    global.window.initBackupsPanel = vi.fn();

    const mod = await import('../js/tabs.js');
    await mod.initTabs(null, {});

    const btn = document.querySelector('.tab-button[data-target="dailyPanel"]');
    btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

    const list = document.getElementById('dailyTasksList');
    expect(list.innerHTML).toBe('');

    // resolve to avoid unhandled promise rejection
    if (resolve) resolve();
  });
});
