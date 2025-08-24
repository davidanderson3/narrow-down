import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

const setMock = vi.fn();
const getMock = vi.fn();

// Simple localStorage mock
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

function createAuthMock() {
  const docFn = vi.fn(() => ({
    collection: collectionFn,
    doc: docFn,
    get: getMock,
    set: setMock
  }));
  function collectionFn() { return { doc: docFn }; }
  return {
    getCurrentUser: () => ({ uid: 'u1' }),
    db: { collection: collectionFn },
    auth: { onAuthStateChanged: vi.fn() }
  };
}

vi.mock('../js/auth.js', createAuthMock);

import { calculateMonthlyBudget, loadBudgetData } from '../js/budget.js';

async function calculateCurrentMonthlyBudgetForTest() {
  const budget = await loadBudgetData();
  const {
    subscriptions = {},
    recurring = {},
    incomeRecurring = {},
    netPay,
    salary,
    removedBuiltIns,
    goalSubscriptions,
    goalRecurring,
    goalIncomeRecurring,
    lastUpdated,
    ...rest
  } = budget;
  const categories = { ...rest, ...recurring, ...subscriptions };
  Object.keys(categories).forEach(k => {
    if (k.startsWith('goal_') || ['removedBuiltIns', 'lastUpdated'].includes(k)) {
      delete categories[k];
    }
  });
  return calculateMonthlyBudget({ salary, netPay, categories, incomeCategories: incomeRecurring });
}

beforeEach(() => {
  setMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  vi.doMock('../js/auth.js', createAuthMock);
  localStorage.clear();
});

describe('budget calculations', () => {
  it('calculates monthly budget', () => {
    const res = calculateMonthlyBudget({
      salary: 120000,
      categories: {
        mortgagePrincipal: 1500,
        mortgageInterest: 500,
        'Amazon Prime': 15,
        tolls: 30,
        investmentAccounts: 300,
        dentalInsurance: 50
      }
    });
    const expectedExpenses = 1500 + 500 + 15 + 30 + 300 + 50;
    expect(res.federalTax).toBe(1000);
    expect(res.tax).toBe(1000);
    expect(res.netPay).toBe(9000);
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.monthlyIncome).toBe(10000);
    expect(res.leftover).toBe(7605);
  });

  it('uses provided gross pay', () => {
    const res = calculateMonthlyBudget({
      netPay: 6000,
      categories: { prime: 15, tolls: 30 }
    });
    const expectedExpenses = 15 + 30; // tax excluded
    expect(res.tax).toBe(600);
    expect(res.netPay).toBe(5400);
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.leftover).toBe(5955);
  });

  it('adds income categories to the summary', () => {
    const res = calculateMonthlyBudget({
      salary: 120000,
      categories: { mortgagePrincipal: 1500 },
      incomeCategories: { sideJob: 500 }
    });
    expect(res.expenses).toBe(1500);
    expect(res.income).toBe(500);
    expect(res.netPay).toBe(9500);
    expect(res.leftover).toBe(9000);
    expect(res.monthlyIncome).toBe(10000);
  });

  it('calculates the current monthly budget from saved data', async () => {
    const stored = {
      subscriptions: { Netflix: 15 },
      investmentAccounts: 300,
      salary: 120000,
      incomeRecurring: { sideJob: 200 }
    };
    localStorage.setItem('budgetConfig', JSON.stringify(stored));
    const res = await calculateCurrentMonthlyBudgetForTest();
    const expectedExpenses = 300 + 15;
    expect(res.expenses).toBe(expectedExpenses);
    expect(res.income).toBe(200);
    expect(res.leftover).toBe(9885);
  });
});

describe('budget persistence', () => {
  it('loads data from Firestore', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ escrow: 50 }) });
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.escrow).toBe(50);
    expect(res.subscriptions).toEqual({});
    expect(res.recurring).toEqual({});
    expect(res.goalSubscriptions).toEqual({});
    expect(res.goalRecurring).toEqual({});
    expect(typeof res.lastUpdated).toBe('number');
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { saveBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ escrow: 75 });
    const saved = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(saved.escrow).toBe(75);
    expect(saved.subscriptions).toEqual({});
    expect(saved.recurring).toEqual({});
    expect(saved.goalSubscriptions).toEqual({});
    expect(saved.goalRecurring).toEqual({});
    expect(typeof saved.lastUpdated).toBe('number');
    expect(setMock).toHaveBeenCalledWith(saved, { merge: true });
  });

  it('does not persist data in localStorage when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {}, auth: { onAuthStateChanged: vi.fn() } }));
    const { saveBudgetData, loadBudgetData } = await import('../js/budget.js');
    await saveBudgetData({ escrow: 80 });
    expect(localStorage.getItem('budgetConfig')).toBeNull();
    const data = await loadBudgetData();
    expect(data.escrow).toBeUndefined();
    expect(data.recurring).toEqual({});
    expect(data.goalSubscriptions).toEqual({});
    expect(data.goalRecurring).toEqual({});
  });

  it('prefers newer data source when merging', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ lastUpdated: 200 }) });
    localStorage.setItem('budgetConfig', JSON.stringify({ escrow: 100, lastUpdated: 100 }));
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.escrow).toBeUndefined();
    expect(res.lastUpdated).toBe(200);
  });

  it('does not resurrect deleted entries from older data', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ escrow: 50, lastUpdated: 100 }) });
    localStorage.setItem('budgetConfig', JSON.stringify({ lastUpdated: 200 }));
    const { loadBudgetData } = await import('../js/budget.js');
    const res = await loadBudgetData();
    expect(res.escrow).toBeUndefined();
    expect(res.lastUpdated).toBe(200);
  });

  it('preserves existing fields in Firestore', async () => {
    let remote = { custom: 'keep' };
    setMock.mockImplementation((data, opts) => {
      remote = opts && opts.merge ? { ...remote, ...data } : data;
      return Promise.resolve();
    });
    getMock.mockImplementation(() => Promise.resolve({ exists: true, data: () => remote }));

    const { saveBudgetData, loadBudgetData } = await import('../js/budget.js');

    await saveBudgetData({ escrow: 50 });
    expect(remote.custom).toBe('keep');
    expect(remote.escrow).toBe(50);

    await saveBudgetData({ escrow: 75 });
    expect(remote.custom).toBe('keep');
    expect(remote.escrow).toBe(75);

    const result = await loadBudgetData();
    expect(result.escrow).toBe(75);
    expect(remote.custom).toBe('keep');
  });
});

describe('budget panel', () => {
  it('saves goal recurring expenses', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    dom.window.openBudgetItemForm({ name: 'Test Recurring', type: 'expense' });

    const expenseInputs = document.querySelectorAll('#budgetTbody tr[data-type="expense"] .goal-cost');
    const costInput = expenseInputs[expenseInputs.length - 1];
    costInput.value = '50';
    costInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    costInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    await new Promise(res => setTimeout(res, 0));

    const saved = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(saved.goalRecurring).toEqual({ 'Test Recurring': '50' });
    expect(setMock).toHaveBeenCalled();
  });

  it('saves goal subscription expenses', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    dom.window.openBudgetItemForm({ name: 'Test Subscription', type: 'subscription' });

    const subInputs = document.querySelectorAll('#budgetTbody tr[data-type="subscription"] .goal-cost');
    const costInput = subInputs[subInputs.length - 1];
    costInput.value = '10';
    costInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    costInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    await new Promise(res => setTimeout(res, 0));

    const saved = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(saved.goalSubscriptions).toEqual({ 'Test Subscription': '10' });
    expect(setMock).toHaveBeenCalled();
  });

  it('saves income categories', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    dom.window.openBudgetItemForm({ name: 'Side Job', type: 'income' });

    const incomeRows = document.querySelectorAll('#budgetTbody tr[data-type="income"]');
    const incomeRow = incomeRows[incomeRows.length - 1];
    const incomeInput = incomeRow.querySelector('.current-cost');
    incomeInput.value = '200';
    incomeInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    incomeInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(incomeRow.querySelector('.type-cell').textContent).toBe('Income');

    await new Promise(res => setTimeout(res, 0));

    const saved = JSON.parse(localStorage.getItem('budgetConfig'));
    expect(saved.incomeRecurring).toEqual({ 'Side Job': '200' });
    expect(setMock).toHaveBeenCalled();
  });

  it('reorders categories with the up button', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    dom.window.openBudgetItemForm({ name: 'First', type: 'expense' });
    dom.window.openBudgetItemForm({ name: 'Second', type: 'expense' });

    const rows = document.querySelectorAll('#budgetTbody tr[data-type="expense"]');
    rows[rows.length - 1].querySelector('button[title="Move up"]').click();

    const order = Array.from(document.querySelectorAll('#budgetTbody .cat-name'))
      .slice(-2)
      .map(el => el.textContent);
    expect(order[0]).toBe('Second');
  });

  it('does not show rent after escrow in the summaries', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    function setCost(field, current, goal) {
      const row = document.querySelector(`#budgetTbody tr[data-field="${field}"]`);
      const curInput = row.querySelector('.current-cost');
      const goalInput = row.querySelector('.goal-cost');
      curInput.value = String(current);
      curInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      goalInput.value = String(goal);
      goalInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }

    setCost('mortgagePrincipal', 1000, 900);
    setCost('mortgageInterest', 500, 400);
    setCost('escrow', 300, 200);

    const summary = document.getElementById('budgetSummary').textContent;
    expect(summary).not.toContain('Rent After Escrow');
  });

  it('places Rent in the Mortgage/Rent section by default', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    const rentRow = document.querySelector('tr[data-field="rent"]');
    expect(rentRow).not.toBeNull();

    let sectionHeader = rentRow.previousElementSibling;
    while (sectionHeader && !sectionHeader.classList.contains('section-row')) {
      sectionHeader = sectionHeader.previousElementSibling;
    }
    expect(sectionHeader).not.toBeNull();
    expect(sectionHeader.dataset.section).toBe('Mortgage/Rent');
  });

  it('displays current and goal leftover in the summary', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    dom.window.openBudgetItemForm({ name: 'Job', type: 'income' });
    const incomeRow = document.querySelector('tr[data-type="income"]');
    incomeRow.querySelector('.current-cost').value = '5000';
    incomeRow.querySelector('.current-cost').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    incomeRow.querySelector('.goal-cost').value = '6000';
    incomeRow.querySelector('.goal-cost').dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    const expenseRow = document.querySelector('tr[data-field="mortgagePrincipal"]');
    expenseRow.querySelector('.current-cost').value = '3000';
    expenseRow.querySelector('.current-cost').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expenseRow.querySelector('.goal-cost').value = '2500';
    expenseRow.querySelector('.goal-cost').dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    const leftoverRow = document.querySelector(
      '#budgetSummary .budget-summary-table tr:nth-child(4)'
    );
    const cells = leftoverRow.querySelectorAll('td');
    expect(cells[0].textContent).toBe('Leftover: $2,000');
    expect(cells[1].textContent).toBe('Leftover: $3,500');

  });

  it('shows the summary inside the layout', async () => {
    getMock.mockResolvedValue({ exists: false });

    const dom = new JSDOM('<div id="budgetContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;

    const { initBudgetPanel } = await import('../js/budget.js');
    await initBudgetPanel();

    const layout = document.getElementById('budgetLayout');
    const summary = document.getElementById('budgetSummary');
    expect(layout.contains(summary)).toBe(true);
  });
});
