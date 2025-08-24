import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

vi.mock('../js/helpers.js', () => ({
  loadDecisions: vi.fn(async () => []),
  saveDecisions: vi.fn(async () => {}),
  saveGoalOrder: vi.fn(async () => {}),
  loadGoalOrder: vi.fn(async () => []),
  generateId: vi.fn(() => 'id1'),
  parseNaturalDate: vi.fn()
}));

vi.mock('../js/goals.js', () => ({
  renderGoalsAndSubitems: vi.fn(),
  appendGoalToDOM: vi.fn()
}));

beforeEach(() => {
  vi.resetModules();
  global.firebase = {
    auth: () => ({ currentUser: { uid: 'user1' } })
  };
  global.prompt = vi.fn(() => '');
});

describe('saveGoalWizard', () => {
  it('saves scheduled goal when dates provided', async () => {
    const mod = await import('../js/wizard.js');
    const { wizardState, initWizard, saveGoalWizard } = mod;
    initWizard({
      wizardContainer: { style: {} },
      addProjectBtn: { style: {} },
      cancelBtn: {},
      backBtn: { style: {} },
      nextBtn: {},
      wizardStep: {}
    });

    Object.assign(wizardState, {
      goalText: 'My goal',
      calendarStartDate: '2024-01-02',
      calendarEndDate: '',
      subgoals: [],
      editingGoalId: null
    });

    await saveGoalWizard();
    const helpers = await import('../js/helpers.js');
    expect(helpers.saveDecisions).toHaveBeenCalled();
    const saved = helpers.saveDecisions.mock.calls[0][0];
    expect(saved).toEqual([
      expect.objectContaining({
        text: 'My goal',
        scheduled: '2024-01-02',
        scheduledEnd: ''
      })
    ]);
  });
});

describe('initWizard', () => {
  it('focuses first input when wizard opens', async () => {
    const dom = new JSDOM(`
      <div id="projectWizardModal" style="display:none;"></div>
      <div id="wizardStep"></div>
      <button id="wizardNextBtn"></button>
      <button id="wizardBackBtn"></button>
      <button id="wizardCancelBtn"></button>
      <button id="addProjectBtn"></button>
    `);
    global.window = dom.window;
    global.document = dom.window.document;

    const mod = await import('../js/wizard.js');
    const { initWizard } = mod;
    initWizard({
      wizardContainer: document.getElementById('projectWizardModal'),
      addProjectBtn: document.getElementById('addProjectBtn'),
      cancelBtn: document.getElementById('wizardCancelBtn'),
      backBtn: document.getElementById('wizardBackBtn'),
      nextBtn: document.getElementById('wizardNextBtn'),
      wizardStep: document.getElementById('wizardStep')
    });

    document.getElementById('addProjectBtn').click();
    expect(document.activeElement.id).toBe('goalTextInput');
  });
});
