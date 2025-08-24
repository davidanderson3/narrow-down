/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('settingsPage bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<button id="bottomLogoutBtn"></button>';
  });

  it('runs initialization immediately when DOM is ready', async () => {
    const initSettingsPage = vi.fn();
    const initAuth = vi.fn();
    vi.doMock('../js/settings.js', () => ({ initSettingsPage }));
    vi.doMock('../js/auth.js', () => ({ initAuth }));

    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });

    await import('../js/settingsPage.js');

    expect(initSettingsPage).toHaveBeenCalled();
    expect(initAuth).toHaveBeenCalled();
  });
});
