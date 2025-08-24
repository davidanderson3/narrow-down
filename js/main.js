import { initTabs } from './tabs.js';

window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  } else {
    console.warn('Service workers are not supported; offline features will be limited.');
  }

  initTabs();
});
