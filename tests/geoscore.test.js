import { describe, it, expect, beforeEach } from 'vitest';
import { loadQuestions, saveQuestions, DEFAULT_QUESTIONS } from '../js/geoscore.js';

describe('geoscore persistence', () => {
  beforeEach(() => {
    const store = {};
    global.localStorage = {
      getItem: key => (key in store ? store[key] : null),
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: key => { delete store[key]; }
    };
    global.fetch = async () => ({ ok: false });
  });

  it('provides default questions when storage is empty', async () => {
    expect(await loadQuestions()).toEqual(DEFAULT_QUESTIONS);
  });

  it('saves and loads answer counts', async () => {
    const qs = [{
      question: 'Capital of France?',
      answers: [
        { answer: 'Paris', score: 1, count: 2 },
        { answer: 'Lyon', score: 0, count: 1 }
      ]
    }];
    saveQuestions(qs);
    expect(await loadQuestions()).toEqual(qs);
  });
});
