import { describe, it, expect, vi } from 'vitest';
vi.mock('../js/helpers.js', () => ({}));
import { renderGoalsReport } from '../js/tabReports.js';

describe('renderGoalsReport', () => {
  it('clears the container when rendering', () => {
    const container = { innerHTML: '', textContent: '' };
    global.document = {
      getElementById: (id) => (id === 'goalsReport' ? container : null)
    };
    const items = [
      { id: 'g1', type: 'goal', completed: false },
      { id: 't1', type: 'task', parentGoalId: 'g1', completed: false },
      { id: 't2', type: 'task', parentGoalId: 'g1', completed: true },
      { id: 'g2', type: 'goal', completed: true },
      { id: 't3', type: 'task', parentGoalId: 'g2', completed: false },
      { id: 't4', type: 'task', parentGoalId: 'g2', completed: true },
      { id: 't5', type: 'task', completed: false }
    ];

    renderGoalsReport(items);

    expect(container.innerHTML).toBe('');
  });

  it('ignores missing container', () => {
    global.document = { getElementById: () => null };
    const items = [];

    renderGoalsReport(items);
    // nothing to assert, just ensure no error
  });

  it('works with hidden tasks', () => {
    const container = { innerHTML: '', textContent: '' };
    global.document = {
      getElementById: (id) => (id === 'goalsReport' ? container : null)
    };
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    const items = [
      { id: 'g1', type: 'goal', completed: false, hiddenUntil: future },
      { id: 't1', type: 'task', parentGoalId: 'g1', completed: false }
    ];

    renderGoalsReport(items);
    expect(container.innerHTML).toBe('');
  });
});

