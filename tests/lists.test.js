import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadLists: vi.fn(),
  saveLists: vi.fn(),
  loadDecisions: vi.fn(),
  saveDecisions: vi.fn(),
  generateId: vi.fn(),
  pickDate: vi.fn(),
  makeIconBtn: (symbol, title, fn) => {
    const b = document.createElement('button');
    b.textContent = symbol;
    b.title = title;
    b.onclick = fn;
    return b;
  }
}));

vi.mock('../js/goals.js', () => ({
  appendGoalToDOM: vi.fn()
}));

vi.mock('../js/auth.js', () => ({
  auth: { onAuthStateChanged: (cb) => cb() },
  db: {}
}));

let helpers;
let goals;

beforeEach(async () => {
  vi.resetModules();
  const dom = new JSDOM('<div id="listsPanel"><div class="full-column"><div class="panel-header"></div></div></div><div id="listsFormModal"><div id="listsFormWrapper"></div></div><button class="tab-button active" data-target="listsPanel"></button><div id="goalList"></div>', { url: 'http://localhost' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  helpers = await import('../js/helpers.js');
  goals = await import('../js/goals.js');
  helpers.loadLists.mockResolvedValue([{ name: 'Test', columns: [], items: [], hiddenUntil: null }]);
  helpers.loadDecisions.mockResolvedValue([]);
  helpers.generateId.mockReturnValue('g1');
  helpers.pickDate.mockResolvedValue('');
  await import('../js/lists.js');
  await Promise.resolve();
});

describe.skip('list postponing', () => {
  it('sets hiddenUntil based on selected option', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));

    const buttons = [...document.querySelectorAll('.postpone-option')];
    expect(buttons.some(btn => btn.textContent === '20 hours')).toBe(true);
    expect(buttons.some(btn => btn.textContent === 'Pick date…')).toBe(true);
    const option = buttons.find(btn => btn.textContent === '2 days');
    option.click();
    vi.advanceTimersByTime(300);

    expect(helpers.saveLists).toHaveBeenCalled();
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0];
    expect(saved.hiddenUntil).toBe(new Date('2023-01-03T00:00:00.000Z').toISOString());

    vi.useRealTimers();
  });

  it('sets hiddenUntil based on chosen date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));

    helpers.pickDate.mockResolvedValue('2023-01-10');
    const pickBtn = [...document.querySelectorAll('.postpone-option')].find(btn => btn.textContent === 'Pick date…');
    pickBtn.click();
    await Promise.resolve();
    vi.advanceTimersByTime(300);
    await Promise.resolve();

    expect(helpers.saveLists).toHaveBeenCalled();
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0];
    expect(saved.hiddenUntil).toBe(new Date('2023-01-10T00:00:00.000Z').toISOString());

    vi.useRealTimers();
  });
});

describe.skip('openListsFormModal', () => {
  it('focuses the first input when modal opens', () => {
    window.openListsFormModal();
    const first = document.querySelector('#listsFormModal input, #listsFormModal textarea');
    expect(document.activeElement).toBe(first);
  });
});

describe('addListItemGoal', () => {
  it('creates goal from first column label', async () => {
    const list = { name: 'Test', columns: [{ name: 'Item', type: 'text' }], items: [{ Item: 'Do it' }], hiddenUntil: null };
    document.getElementById('listsPanel').innerHTML = '<div class="full-column"><div class="panel-header"></div></div>';
    vi.resetModules();
    helpers = await import('../js/helpers.js');
    goals = await import('../js/goals.js');
    helpers.loadLists.mockResolvedValue([list]);
    helpers.loadDecisions.mockResolvedValue([]);
    helpers.generateId.mockReturnValue('g1');
    await import('../js/lists.js');
    await Promise.resolve();
    const btn = document.querySelector('button[title="Add as goal"]');
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(helpers.saveDecisions).toHaveBeenCalled();
    const newGoal = helpers.saveDecisions.mock.calls[0][0].pop();
    expect(newGoal.text).toBe('Do it');
    expect(goals.appendGoalToDOM).toHaveBeenCalled();
  });
});

describe.skip('unhideListItem button', () => {
  it('clears hiddenUntil when clicked', async () => {
    const hideTime = '2030-01-01T00:00:00.000Z';
    document.getElementById('listsPanel').innerHTML = '<div class="full-column"><div class="panel-header"></div></div>';
    vi.resetModules();
    helpers = await import('../js/helpers.js');
    goals = await import('../js/goals.js');
    helpers.loadLists.mockResolvedValue([{ name: 'Test', columns: [{ name: 'Item', type: 'text' }], items: [{ Item: 'One', hiddenUntil: hideTime }], hiddenUntil: null }]);
    await import('../js/lists.js');
    vi.useFakeTimers();
    await window.initListsPanel();

    const btn = document.querySelector('#hiddenItemsContent button');
    expect(btn).toBeTruthy();
    btn.click();
    vi.advanceTimersByTime(300);
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0].items[0];
    expect(saved.hiddenUntil).toBe(null);
    vi.useRealTimers();
  });
});

describe.skip('unhide list button', () => {
  it('clears list hiddenUntil when clicked', async () => {
    const hideTime = '2030-01-01T00:00:00.000Z';
    document.getElementById('listsPanel').innerHTML = '<div class="full-column"><div class="panel-header"></div></div>';
    vi.resetModules();
    helpers = await import('../js/helpers.js');
    goals = await import('../js/goals.js');
    helpers.loadLists.mockResolvedValue([{ name: 'Hidden', columns: [], items: [], hiddenUntil: hideTime }]);
    helpers.loadDecisions.mockResolvedValue([]);
    await import('../js/lists.js');
    vi.useFakeTimers();
    await window.initListsPanel();

    const btn = document.querySelector('#hiddenListsContent button');
    expect(btn).toBeTruthy();
    btn.click();
    vi.advanceTimersByTime(300);
    const saved = helpers.saveLists.mock.calls.at(-1)[0][0];
    expect(saved.hiddenUntil).toBe(null);
    vi.useRealTimers();
  });
});

describe('tab descriptions', () => {
  it('preserves description textareas when initializing panel', async () => {
    document.getElementById('listsPanel').innerHTML = `
      <div class="panel-header"><h2>Lists</h2></div>
      <textarea class="tab-description top-description">top</textarea>
      <textarea class="tab-description bottom-description">bottom</textarea>
    `;
    const top = document.querySelector('.tab-description.top-description');
    const bottom = document.querySelector('.tab-description.bottom-description');
    await window.initListsPanel();
    expect(document.querySelector('.tab-description.top-description')).toBe(top);
    expect(document.querySelector('.tab-description.bottom-description')).toBe(bottom);
  });
});
