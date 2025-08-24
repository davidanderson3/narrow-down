import { describe, it, expect } from 'vitest';
import { SAMPLE_DECISIONS, SAMPLE_LISTS } from '../js/sampleData.js';

describe('sample data immutability', () => {
  it('deeply freezes SAMPLE_DECISIONS', () => {
    expect(Object.isFrozen(SAMPLE_DECISIONS)).toBe(true);
    expect(Object.isFrozen(SAMPLE_DECISIONS[0])).toBe(true);
    expect(() => {
      SAMPLE_DECISIONS[0].text = 'changed';
    }).toThrow();
    expect(SAMPLE_DECISIONS[0].text).toBe('Explore this Application');
  });

  it('deeply freezes SAMPLE_LISTS', () => {
    expect(Object.isFrozen(SAMPLE_LISTS)).toBe(true);
    expect(Object.isFrozen(SAMPLE_LISTS[0])).toBe(true);
    expect(Object.isFrozen(SAMPLE_LISTS[0].items)).toBe(true);
    expect(Object.isFrozen(SAMPLE_LISTS[0].items[0])).toBe(true);
    expect(() => {
      SAMPLE_LISTS[0].items.push({ Title: 'https://example.com', Title_label: 'Test', Author: 'Tester' });
    }).toThrow();
    expect(SAMPLE_LISTS[0].items).toHaveLength(3);
    expect(() => {
      SAMPLE_LISTS[0].items[0].Title_label = 'Changed';
    }).toThrow();
    expect(SAMPLE_LISTS[0].items[0].Title_label).toBe('Deep Work');

    const last = SAMPLE_LISTS[SAMPLE_LISTS.length - 1];
    expect(Object.isFrozen(last)).toBe(true);
    expect(Object.isFrozen(last.items)).toBe(true);
    expect(Object.isFrozen(last.items[0])).toBe(true);
  });
});

describe('sample calendar items', () => {
  it('use future dates for scheduled items', () => {
    const today = new Date();
    const dates = [];
    SAMPLE_DECISIONS.forEach(d => {
      if (d.scheduled) {
        dates.push(new Date(d.scheduled));
      }
      if (d.scheduledEnd) {
        dates.push(new Date(d.scheduledEnd));
      }
    });
    expect(dates.length).toBeGreaterThan(0);
    dates.forEach(date => {
      expect(date.getTime()).toBeGreaterThan(today.getTime());
    });
  });
});
