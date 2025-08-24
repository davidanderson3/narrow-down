import { currentUser } from './auth.js';
import { loadTabOrder } from './settings.js';

export const PANELS = [
  'dailyPanel',
  'projectsPanel',
  'calendarPanel',
  'metricsPanel',
  'listsPanel',
  'travelPanel',
  'moviesPanel',
  'showsPanel',
  'recipesPanel',
  'planningPanel',
  'budgetPanel',
  'backupsPanel',
  'geoscorePanel',
  'geolayersPanel'
];

export const PANEL_NAMES = {
  projectsPanel: 'Projects',
  calendarPanel: 'Calendar',
  dailyPanel: 'Routine',
  metricsPanel: 'Metrics',
  listsPanel: 'Lists',
  travelPanel: 'Places',
  moviesPanel: 'Movies',
  showsPanel: 'Live Music',
  recipesPanel: 'Recipes',
  planningPanel: 'Finances',
  budgetPanel: 'Budget',
  backupsPanel: 'Backups',
  geoscorePanel: 'GeoScore',
  geolayersPanel: 'GeoLayers'
};

let tabsInitialized = false;

export async function initTabs(user, db) {
  // Only attach listeners once; handlers reference the shared currentUser
  if (tabsInitialized) return;
  tabsInitialized = true;

  const LAST_PANEL_KEY = 'lastPanel';

  const container = document.getElementById('tabsContainer');
  let tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  let panels = user
    ? PANELS
    : PANELS.filter(id => id !== 'backupsPanel' && id !== 'geolayersPanel');

  try {
    const saved = await loadTabOrder();
    if (Array.isArray(saved) && saved.length) {
      const ordered = saved.filter(id => panels.includes(id));
      ordered.push(...panels.filter(id => !ordered.includes(id)));
      panels = ordered;
      if (container) {
        panels.forEach(id => {
          const btn = container.querySelector(`.tab-button[data-target="${id}"]`);
          if (btn) container.appendChild(btn);
        });
        tabButtons = Array.from(container.querySelectorAll('.tab-button'));
      }
    }
  } catch {}

  tabButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      // 1) toggle active state
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 2) show/hide panels
      const target = btn.dataset.target;

      // Clear routine list before displaying to avoid flashing stale tasks
      if (target === 'dailyPanel') {
        const list = document.getElementById('dailyTasksList');
        if (list) list.innerHTML = '';
      }

      panels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === target) ? 'flex' : 'none';
      });

      // Remember selected panel
      try { localStorage.setItem(LAST_PANEL_KEY, target); } catch {}

      // 3) update URL hash
      history.pushState(null, '', `#${target}`);

      // 4) init dynamic content
      if (target === 'dailyPanel') {
        await window.renderDailyTasks(currentUser, db);
      }
      else if (target === 'metricsPanel') {
        await window.initMetricsUI();
      }
      else if (target === 'listsPanel') {
        await window.initListsPanel(currentUser, db);
      }
      else if (target === 'travelPanel') {
        await window.initTravelPanel();
      }
      else if (target === 'moviesPanel') {
        await window.initMoviesPanel();
      }
        else if (target === 'showsPanel') {
          await window.initShowsPanel();
        }
        else if (target === 'recipesPanel') {
          await window.initRecipesPanel();
        }
        else if (target === 'planningPanel') {
          await window.initPlanningPanel();
        }
      else if (target === 'budgetPanel') {
        await window.initBudgetPanel();
      }
      else if (target === 'backupsPanel') {
        await window.initBackupsPanel();
      }
      else if (target === 'geoscorePanel') {
        window.initGeoScorePanel();
      }
    });
  });

  // initial activation from hash or default
  const hash    = window.location.hash.substring(1);
  let saved     = null;
  try { saved = localStorage.getItem(LAST_PANEL_KEY); } catch {}
  const initial = (hash && panels.includes(hash))
    ? hash
    : (saved && panels.includes(saved))
      ? saved
      : document.querySelector('.tab-button.active')?.dataset.target || panels[0];

  tabButtons.forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-button[data-target="${initial}"]`)?.classList.add('active');
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === initial) ? 'flex' : 'none';
  });

  try { localStorage.setItem(LAST_PANEL_KEY, initial); } catch {}

  // on load, fire any needed init. If DOMContentLoaded already fired,
  // run immediately instead of waiting for the event.
  const runInitial = () => {
    if (initial === 'dailyPanel') {
      if (typeof window.renderDailyTasks === 'function') {
        window.renderDailyTasks(currentUser, db);
      }
    }
    else if (initial === 'metricsPanel') {
      window.initMetricsUI();
    }
    else if (initial === 'listsPanel') {
      window.initListsPanel(currentUser, db);
    }
    else if (initial === 'travelPanel') {
      window.initTravelPanel();
    }
    else if (initial === 'moviesPanel') {
      window.initMoviesPanel();
    }
      else if (initial === 'showsPanel') {
        window.initShowsPanel();
      }
      else if (initial === 'recipesPanel') {
        window.initRecipesPanel();
      }
      else if (initial === 'planningPanel') {
        window.initPlanningPanel();
      }
    else if (initial === 'budgetPanel') {
      window.initBudgetPanel();
    }
    else if (initial === 'backupsPanel') {
      window.initBackupsPanel();
    }
    else if (initial === 'geoscorePanel') {
      window.initGeoScorePanel();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitial);
  } else {
    runInitial();
  }
}
