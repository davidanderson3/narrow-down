import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  restoreBackup: vi.fn().mockResolvedValue('backup-1'),
  loadDecisions: vi.fn().mockResolvedValue([])
}));

import { initBackupsPanel } from '../js/backups.js';
import { restoreBackup, loadDecisions } from '../js/helpers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initBackupsPanel', () => {
  it('renders backups and invokes restore', async () => {
    const dom = new JSDOM('<div id="backupsPanel"><ul id="backupList"></ul></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.alert = vi.fn();
    global.localStorage = {
      length: 2,
      key: i => ['backup-1', 'other'][i],
      getItem: () => '[]'
    };

    initBackupsPanel();
    const btn = document.querySelector('#backupList li button');
    expect(btn).toBeTruthy();
    btn.click();
    expect(restoreBackup).toHaveBeenCalledWith(expect.any(Function));
  });

  it('creates a backup when Backup Now is clicked', async () => {
    const dom = new JSDOM('<div id="backupsPanel"><button id="backupNowBtn"></button><ul id="backupList"></ul></div>');
    global.window = dom.window;
    global.document = dom.window.document;
    const store = {};
    global.localStorage = {
      length: 0,
      key: i => Object.keys(store)[i],
      getItem: k => store[k],
      setItem: (k, v) => {
        store[k] = String(v);
        global.localStorage.length = Object.keys(store).length;
      }
    };
    loadDecisions.mockResolvedValue([{ id: 1 }]);

    initBackupsPanel();
    document.getElementById('backupNowBtn').click();
    await Promise.resolve();

    expect(loadDecisions).toHaveBeenCalled();
    const keys = Object.keys(store);
    expect(keys).toHaveLength(1);
    expect(keys[0].startsWith('backup-')).toBe(true);
  });
});
