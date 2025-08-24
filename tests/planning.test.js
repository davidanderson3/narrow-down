
import { calculateFinanceProjection, estimateSocialSecurity } from '../js/planning.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple budget allocation helper used only in tests. It breaks a monthly income
// into basic categories of taxes, mortgage and leftover funds.
function calculateBudgetAllocation({ income = 0, taxRate = 0, mortgage = 0 }) {
  income = Number(income) || 0;
  taxRate = Number(taxRate) || 0;
  mortgage = Number(mortgage) || 0;

  const taxes = Math.round(income * (taxRate / 100));
  const leftover = income - taxes - mortgage;

  return { taxes, mortgage, leftover };
}

describe('planning calculations', () => {
  it('projects finances over years', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 32,
      savings: 1000,
      annualSavings: 100,
      investmentReturnRate: 0
    });
    expect(res).toEqual([
      { age: 30, balance: 1000, income: 0, realIncome: 0 },
      { age: 31, balance: 1100, income: 0, realIncome: 0 },
      { age: 32, balance: 1200, income: 0, realIncome: 0 }
    ]);
  });

  it('includes income before retirement', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 32,
      savings: 1000,
      annualSavings: 100,
      income: 50000,
      investmentReturnRate: 0
    });
    expect(res).toEqual([
      { age: 30, balance: 1000, income: 50000, realIncome: 50000 },
      { age: 31, balance: 1100, income: 50000, realIncome: 50000 },
      { age: 32, balance: 1200, income: 50000, realIncome: 50000 }
    ]);
  });

  it('accounts for steady income increases', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 32,
      savings: 1000,
      annualSavings: 100,
      income: 50000,
      annualRaise: 10,
      investmentReturnRate: 0
    });
    expect(res).toEqual([
      { age: 30, balance: 1000, income: 50000, realIncome: 50000 },
      { age: 31, balance: 1100, income: 55000, realIncome: 55000 },
      { age: 32, balance: 1210, income: 60500, realIncome: 60500 }
    ]);
  });

  it('projects retirement income after retirement age', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 31,
      savings: 1000,
      annualSavings: 100,
      investmentReturnRate: 0,
      pension: 10,
      socialSecurity: 50,
      postYears: 1,
      withdrawalRate: 4
    });
    expect(res).toEqual([
      { age: 30, balance: 1000, income: 0, realIncome: 0 },
      { age: 31, balance: 1100, income: 0, realIncome: 0 },
      {
        age: 32,
        balance: 1056,
        income: 104,
        realIncome: 104,
        withdrawal: 44,
        pension: 10,
        socialSecurity: 50
      }
    ]);
  });

  it('increases withdrawals by 3% each year', () => {
    const res = calculateFinanceProjection({
      currentAge: 30,
      retirementAge: 31,
      savings: 1000,
      investmentReturnRate: 0,
      postYears: 2,
      withdrawalRate: 4
    });
    expect(res.slice(-2)).toEqual([
      { age: 32, balance: 960, income: 40, realIncome: 40, withdrawal: 40, pension: 0, socialSecurity: 0 },
      { age: 33, balance: 919, income: 41, realIncome: 41, withdrawal: 41, pension: 0, socialSecurity: 0 }
    ]);
  });

  it('indexes social security by inflation', () => {
    const res = calculateFinanceProjection({
      currentAge: 65,
      retirementAge: 65,
      savings: 0,
      investmentReturnRate: 0,
      socialSecurity: 100,
      postYears: 2,
      withdrawalRate: 0,
      inflationRate: 2
    });
    expect(res.slice(-2)).toEqual([
      { age: 66, balance: 0, income: 100, realIncome: 98, withdrawal: 0, pension: 0, socialSecurity: 100 },
      { age: 67, balance: 0, income: 102, realIncome: 98, withdrawal: 0, pension: 0, socialSecurity: 102 }
    ]);
  });

  it('indexes pension by inflation', () => {
    const res = calculateFinanceProjection({
      currentAge: 65,
      retirementAge: 65,
      savings: 0,
      investmentReturnRate: 0,
      pension: 100,
      postYears: 2,
      withdrawalRate: 0,
      inflationRate: 2
    });
    expect(res.slice(-2)).toEqual([
      { age: 66, balance: 0, income: 100, realIncome: 98, withdrawal: 0, pension: 100, socialSecurity: 0 },
      { age: 67, balance: 0, income: 102, realIncome: 98, withdrawal: 0, pension: 102, socialSecurity: 0 }
    ]);
  });

  it('calculates budget allocation', () => {
    const res = calculateBudgetAllocation({ income: 1000, taxRate: 10, mortgage: 300 });
    expect(res).toEqual({ taxes: 100, mortgage: 300, leftover: 600 });
  });

  it('estimates social security from lifetime income', () => {
    const est = estimateSocialSecurity({ income: 50000, currentAge: 30, retirementAge: 65 });
    expect(est).toBe(20000);
  });
});

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

beforeEach(() => {
  setMock.mockClear();
  getMock.mockClear();
  vi.resetModules();
  vi.doMock('../js/auth.js', createAuthMock);
  localStorage.clear();
});

describe('planning persistence', () => {
  it('loads data from Firestore', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ finance: { curAge: '30' } }) });
    const { loadPlanningData } = await import('../js/planning.js');
    const res = await loadPlanningData();
    expect(res.finance.curAge).toBe('30');
    expect(typeof res.lastUpdated).toBe('number');
    expect(getMock).toHaveBeenCalled();
  });

  it('saves data to Firestore', async () => {
    const { savePlanningData } = await import('../js/planning.js');
    await savePlanningData({ finance: { curAge: '30' } });
    const saved = JSON.parse(localStorage.getItem('planningData'));
    expect(saved.finance.curAge).toBe('30');
    expect(typeof saved.lastUpdated).toBe('number');
    expect(setMock).toHaveBeenCalledWith(saved, { merge: true });
  });

  it('does not persist data when anonymous', async () => {
    vi.doMock('../js/auth.js', () => ({ getCurrentUser: () => null, db: {}, auth: { onAuthStateChanged: vi.fn() } }));
    const { savePlanningData, loadPlanningData } = await import('../js/planning.js');
    await savePlanningData({ finance: { curAge: '25' } });
    expect(localStorage.getItem('planningData')).toBeNull();
    const data = await loadPlanningData();
    expect(data).toEqual({});
  });

  it('ignores local data by default', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ finance: { curAge: '30', retAge: '60' }, lastUpdated: 200 }) });
    localStorage.setItem('planningData', JSON.stringify({ finance: { curAge: '35' }, assets: { realEstate: 100 }, lastUpdated: 300 }));
    const { loadPlanningData } = await import('../js/planning.js');
    const res = await loadPlanningData();
    expect(res.finance.curAge).toBe('30');
    expect(res.assets).toBeUndefined();
    expect(res.lastUpdated).toBe(200);
  });

  it('merges local data when recoverLocal is true', async () => {
    getMock.mockResolvedValue({ exists: true, data: () => ({ finance: { curAge: '30', retAge: '60' }, lastUpdated: 200 }) });
    localStorage.setItem('planningData', JSON.stringify({ finance: { curAge: '35' }, assets: { realEstate: 100 }, lastUpdated: 300 }));
    const { loadPlanningData } = await import('../js/planning.js');
    const res = await loadPlanningData({ recoverLocal: true });
    expect(res.finance.curAge).toBe('35');
    expect(res.assets.realEstate).toBe(100);
    expect(res.lastUpdated).toBeGreaterThan(200);
    expect(setMock).toHaveBeenCalled();
    expect(localStorage.getItem('planningData')).toBeNull();
  });
});
