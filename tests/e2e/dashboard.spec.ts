import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

let server: ReturnType<typeof spawn>;

// Start the static server before the suite and stop afterwards
// The server simply serves the project at http://localhost:3002

const serverPath = path.join(__dirname, '../../backend/server.js');

test.beforeAll(async () => {
  server = spawn('node', [serverPath], { stdio: 'inherit' });
  // give the server a moment to start
  await new Promise(r => setTimeout(r, 1000));
});

test.afterAll(() => {
  server.kill();
});

// Stub external resources (Firebase, Google APIs, etc.) so the tests run
async function stubExternal(page) {
  await page.route(/https:\/\/(www\.gstatic\.com|apis\.google\.com|unpkg\.com|cdn\.jsdelivr\.net|accounts\.google\.com)\/.*$/, route => {
    const isCSS = route.request().url().endsWith('.css');
    route.fulfill({ body: '', contentType: isCSS ? 'text/css' : 'application/javascript' });
  });

  await page.addInitScript(() => {
    // Minimal firebase stub used by auth.js/helpers.js
    (window as any).firebase = {
      initializeApp() {},
      auth: () => ({
        currentUser: { uid: 'e2e-user', email: 'e2e@example.com' },
        onAuthStateChanged: (cb: any) => cb({ uid: 'e2e-user', email: 'e2e@example.com' }),
        signInWithPopup: async () => ({ user: { uid: 'e2e-user' } }),
        signOut: async () => {},
      }),
      firestore: () => ({
        collection: () => ({
          doc: () => ({
            get: async () => ({ data: () => ({ items: [] }) }),
            set: async () => {},
          })
        })
      })
    };
  });
}

test('can add a daily task via UI', async ({ page }) => {
  await stubExternal(page);
  await page.goto('http://localhost:3002');
  await page.evaluate(() => {
    const tabs = document.getElementById('tabsContainer');
    if (tabs) tabs.style.visibility = 'visible';
  });

  // open Routine tab
  await page.waitForSelector('button[data-target="dailyPanel"]', { state: 'visible' });
  await page.click('button[data-target="dailyPanel"]');

  // open add modal
  await page.click('#bottomAddBtn');
  await page.check('input[type=radio][value=daily]');
  await page.check('input[type=radio][name=bottomAddSection][value=morning]');
  await page.fill('#bottomAddText', 'Playwright Task');
  await page.click('#bottomAddSubmit');

  await expect(page.locator('#dailyTasksList')).toContainText('Playwright Task');
});
