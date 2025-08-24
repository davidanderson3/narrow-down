import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMock = vi.fn();
const backupSetMock = vi.fn();
const getMock = vi.fn(() => ({ data: () => ({ items: [{ id: 'old', text: 'b' }] }) }));

const storage = (() => {
  let store = {};
  return {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; },
    key: index => Object.keys(store)[index],
    get length() { return Object.keys(store).length; }
  };
})();

global.localStorage = storage;

vi.mock('../js/auth.js', () => ({
  getCurrentUser: () => ({ uid: 'user1' }),
  auth: { onAuthStateChanged: vi.fn() },
  db: {
    collection: name => ({
      doc: () => {
        if (name === 'restoreBackups') {
          return { set: backupSetMock };
        }
        return { set: setMock, get: getMock };
      }
    })
  }
}));

beforeEach(() => {
  setMock.mockClear();
  backupSetMock.mockClear();
  getMock.mockClear();
  localStorage.clear();
  vi.resetModules();
  global.alert = vi.fn();
  global.confirm = vi.fn(() => true);
});

describe('restoreBackup', () => {
  it('restores selected backup to Firestore with confirmation and server backup', async () => {
    const backupData = [{ id: '1', text: 'a' }];
    localStorage.setItem('backup-2024-01-01', JSON.stringify(backupData));
    const { restoreBackup } = await import('../js/helpers.js');
    const key = await restoreBackup(keys => keys[0]);
    expect(key).toBe('backup-2024-01-01');
    expect(setMock).toHaveBeenCalledWith({ items: backupData }, { merge: true });
    expect(backupSetMock).toHaveBeenCalledWith({ items: [{ id: 'old', text: 'b' }] });
    expect(getMock).toHaveBeenCalled();
    expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining('2024-01-01'));
    expect(global.confirm.mock.calls[0][0]).toContain('1 item');
    expect(localStorage.getItem('cachedDecisions')).toBeNull();
  });

  it('refuses to restore empty backup', async () => {
    localStorage.setItem('backup-2024-01-01', '[]');
    const { restoreBackup } = await import('../js/helpers.js');
    const key = await restoreBackup(keys => keys[0]);
    expect(key).toBeNull();
    expect(setMock).not.toHaveBeenCalled();
    expect(backupSetMock).not.toHaveBeenCalled();
    expect(global.confirm).not.toHaveBeenCalled();
  });

  it('refuses to restore sample dataset backup', async () => {
    const { SAMPLE_DECISIONS } = await import('../js/sampleData.js');
    localStorage.setItem('backup-2024-01-01', JSON.stringify(SAMPLE_DECISIONS));
    const { restoreBackup } = await import('../js/helpers.js');
    const key = await restoreBackup(keys => keys[0]);
    expect(key).toBeNull();
    expect(setMock).not.toHaveBeenCalled();
    expect(backupSetMock).not.toHaveBeenCalled();
    expect(global.confirm).not.toHaveBeenCalled();
  });

  it('returns null when no backups found', async () => {
    const { restoreBackup } = await import('../js/helpers.js');
    const key = await restoreBackup(() => null);
    expect(key).toBeNull();
  });
});

