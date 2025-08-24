import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

var currentUser;
var setMock;
var getMock;
var docMock;
var collectionMock;

vi.mock('../js/auth.js', () => ({
  getCurrentUser: () => currentUser,
  auth: { onAuthStateChanged: vi.fn() },
  db: { collection: (...args) => collectionMock(...args) }
}));

currentUser = { uid: 'u1' };
setMock = vi.fn();
getMock = vi.fn(() => ({ docs: [] }));
docMock = vi.fn(() => ({ collection: collectionMock, doc: docMock, get: getMock, set: setMock }));
collectionMock = vi.fn(() => ({ doc: docMock, collection: collectionMock, orderBy: () => ({ limit: () => ({ get: getMock }) }) }));

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

describe('planning UI persistence', () => {
  it('waits for sign-in before initializing', async () => {
    currentUser = null;
    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate',
      'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings',
      'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    vi.resetModules();
    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();
    expect(dom.window.document.getElementById('planningContainer').innerHTML).toBe('');

    currentUser = { uid: 'u1' };
    await mod.initPlanningPanel();
    expect(dom.window.document.querySelector('#planningForm')).toBeTruthy();
    vi.resetModules();
  });
  it('clears saved values after sign out', async () => {
    let dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate', 'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod1 = await import('../js/planning.js');
    await mod1.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.curAge.value = '30';
    form.realEstate.value = '100000';
    form.carValue.value = '0';
    form.assetSavings.value = '0';
    form.checking.value = '2500';
    form.investment.value = '0';
    form.rollingCredit.value = '0';
    form.annualSavings.value = '5000';
    form.annualRaise.value = '5';
    form.withdrawalRate.value = '6';
    form.postYears.value = '20';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    const saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.finance.curAge).toBe('30');
    expect(saved.assets.realEstate).toBe(100000);
    expect(saved.assets.checking).toBe(2500);
    expect(saved.finance.annualSavings).toBe(5000);
    expect(saved.finance.annualRaise).toBe('5');
    expect(saved.finance.withdrawalRate).toBe(6);
    expect(saved.finance.postYears).toBe(20);

    mod1.clearPlanningCache();
    expect(localStorage.getItem('planningData')).toBeNull();
    currentUser = { uid: 'u2' };

    dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });
    vi.resetModules();
    const mod2 = await import('../js/planning.js');
    await mod2.initPlanningPanel();

    const age2 = document.querySelector('#planningForm input[name="curAge"]').value;
    const estate2 = document.querySelector('#planningForm input[name="realEstate"]').value;
    const checking2 = document.querySelector('#planningForm input[name="checking"]').value;
    const annual2 = document.querySelector('#planningForm input[name="annualSavings"]').value;
    const raise2 = document.querySelector('#planningForm input[name="annualRaise"]').value;
    const wd2 = document.querySelector('#planningForm input[name="withdrawalRate"]').value;
    const post2 = document.querySelector('#planningForm input[name="postYears"]').value;
    expect(age2).toBe('');
    expect(estate2).toBe('');
    expect(checking2).toBe('');
    expect(annual2).toBe('');
    expect(raise2).toBe('');
    expect(wd2).toBe('4');
    expect(post2).toBe('30');
  });

  it('records only one snapshot per day and updates balance', async () => {
    vi.resetModules();
    currentUser = { uid: 'u1' };
    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate', 'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.curAge.value = '30';
    form.realEstate.value = '1000';
    form.carValue.value = '1';
    form.assetSavings.value = '2';
    form.checking.value = '3';
    form.investment.value = '4';
    form.rollingCredit.value = '0';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    let saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(1);
    expect(saved.history[0].balance).toBe(1010);

    form.realEstate.value = '2000';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));
    saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(1);
    expect(saved.history[0].balance).toBe(2010);
  });

  it('records a new snapshot on a new day', async () => {
    vi.resetModules();
    currentUser = { uid: 'u1' };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T10:00:00Z'));

    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate', 'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.curAge.value = '30';
    form.realEstate.value = '1000';
    form.carValue.value = '1';
    form.assetSavings.value = '2';
    form.checking.value = '3';
    form.investment.value = '4';
    form.rollingCredit.value = '0';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    let saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(1);

    vi.setSystemTime(new Date('2023-01-02T09:00:00Z'));
    form.dispatchEvent(new window.Event('input', { bubbles: true }));
    saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(2);
    vi.useRealTimers();
  });

  it('skips snapshot when fields are incomplete', async () => {
    vi.resetModules();
    currentUser = { uid: 'u1' };
    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate', 'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.curAge.value = '30';
    form.realEstate.value = '1000';
    form.carValue.value = '';
    form.assetSavings.value = '2';
    form.checking.value = '3';
    form.investment.value = '4';
    form.rollingCredit.value = '0';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    const saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(0);
  });

  it('does not save data or snapshot when asset total is zero', async () => {
    vi.resetModules();
    currentUser = { uid: 'u1' };
    setMock = vi.fn();
    getMock = vi.fn(() => ({ docs: [] }));
    docMock = vi.fn(() => ({ collection: collectionMock, doc: docMock, get: getMock, set: setMock }));
    collectionMock = vi.fn(() => ({ doc: docMock, collection: collectionMock, orderBy: () => ({ limit: () => ({ get: getMock }) }) }));

    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate',
      'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings',
      'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    let saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(0);
    expect(setMock).not.toHaveBeenCalled();

    form.curAge.value = '30';
    form.realEstate.value = '1000';
    form.carValue.value = '1';
    form.assetSavings.value = '2';
    form.checking.value = '3';
    form.investment.value = '4';
    form.rollingCredit.value = '0';
    form.dispatchEvent(new window.Event('input', { bubbles: true }));

    saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(1);
    expect(setMock).toHaveBeenCalled();
  });

  it('removes snapshots without a timestamp', async () => {
    vi.resetModules();
    currentUser = { uid: 'u1' };
    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    localStorage.setItem('planningData', JSON.stringify({
      history: [
        { timestamp: '2023-01-01T10:00:00Z', age: 30, balance: 100 },
        { age: 31, balance: 200 }
      ]
    }));

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate', 'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();

    const saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.history.length).toBe(1);
    expect(saved.history[0].timestamp).toBeDefined();
  });
});

describe('planning finance tables', () => {
  it('splits projection into working and retirement tables', async () => {
    vi.resetModules();
    currentUser = { uid: 'u1' };
    const dom = new JSDOM('<div id="planningPanel"></div><div id="planningContainer"></div>', { url: 'http://localhost' });
    const prevWin = global.window;
    const prevDoc = global.document;
    global.window = dom.window;
    global.document = dom.window.document;
    localStorage.clear();

    const names = ['curAge', 'retAge', 'income', 'annualSavings', 'annualRaise', 'expenses', 'inflation', 'investmentReturnRate', 'savingsReturnRate', 'withdrawalRate', 'postYears', 'pension', 'socialSecurity', 'realEstate', 'carValue', 'assetSavings', 'checking', 'investment', 'mortgage', 'rollingCredit', 'other'];
    names.forEach(n => {
      Object.defineProperty(dom.window.HTMLFormElement.prototype, n, {
        get() { return this.elements.namedItem(n); },
        configurable: true
      });
    });

    const mod = await import('../js/planning.js');
    await mod.initPlanningPanel();

    const form = document.querySelector('#planningForm');
    form.curAge.value = '30';
    form.retAge.value = '31';
    form.income.value = '50000';
    form.annualSavings.value = '1000';
    form.postYears.value = '1';
    form.realEstate.value = '1000';
    form.carValue.value = '0';
    form.assetSavings.value = '0';
    form.checking.value = '0';
    form.investment.value = '0';
    form.rollingCredit.value = '0';
    form.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    const workingHeading = document.querySelector('#workingColumn h3').textContent;
    const retirementHeading = document.querySelector('#retirementColumn h3').textContent;
    expect([workingHeading, retirementHeading]).toEqual(['Working Years', 'Retirement']);
    expect(document.querySelectorAll('#workingColumn table tbody tr').length).toBe(2);
    expect(document.querySelectorAll('#retirementColumn table tbody tr').length).toBe(1);

    const resetDom = prevWin ? { window: prevWin, document: prevDoc } : new JSDOM('', { url: 'http://localhost' });
    global.window = resetDom.window || resetDom;
    global.document = resetDom.document || resetDom.window.document;
  });
});
