const PANELS = ['moviesPanel', 'showsPanel', 'recipesPanel'];

export function initTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab-button'));
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      PANELS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === target ? 'flex' : 'none';
      });
      if (target === 'moviesPanel') {
        await window.initMoviesPanel?.();
      } else if (target === 'showsPanel') {
        await window.initShowsPanel?.();
      } else if (target === 'recipesPanel') {
        await window.initRecipesPanel?.();
      }
    });
  });

  const first = buttons[0];
  if (first) {
    first.classList.add('active');
    const target = first.dataset.target;
    PANELS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === target ? 'flex' : 'none';
    });
    if (target === 'moviesPanel') {
      window.initMoviesPanel?.();
    } else if (target === 'showsPanel') {
      window.initShowsPanel?.();
    } else if (target === 'recipesPanel') {
      window.initRecipesPanel?.();
    }
  }
}
