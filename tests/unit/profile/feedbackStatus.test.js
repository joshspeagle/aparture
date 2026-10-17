import { describe, it, expect } from 'vitest';
import {
  FILTER_VERDICTS,
  feedbackStatus,
  isFilterVerdict,
  isPendingFeedback,
  isTestFeedback,
} from '../../../lib/profile/feedbackStatus.js';

describe('isFilterVerdict', () => {
  it('accepts exactly YES / MAYBE / NO', () => {
    expect(FILTER_VERDICTS).toEqual(['YES', 'MAYBE', 'NO']);
    for (const v of FILTER_VERDICTS) expect(isFilterVerdict(v)).toBe(true);
    for (const v of [123, undefined, null, 'yes', 'Maybe', '', 'PROBABLY']) {
      expect(isFilterVerdict(v)).toBe(false);
    }
  });
});

describe('isTestFeedback', () => {
  it('flags events stamped testMode', () => {
    expect(isTestFeedback({ type: 'star', testMode: true })).toBe(true);
    expect(isTestFeedback({ type: 'star' })).toBe(false);
  });

  it('flags legacy filter overrides with invalid verdicts (the old dry-run "123")', () => {
    expect(
      isTestFeedback({ type: 'filter-override', originalVerdict: 123, newVerdict: 'NO' })
    ).toBe(true);
    expect(
      isTestFeedback({ type: 'filter-override', originalVerdict: undefined, newVerdict: 'YES' })
    ).toBe(true);
    expect(
      isTestFeedback({ type: 'filter-override', originalVerdict: 'NO', newVerdict: 'YES' })
    ).toBe(false);
  });
});

describe('feedbackStatus', () => {
  it('classifies test events before anything else', () => {
    expect(feedbackStatus({ type: 'star', testMode: true, timestamp: 10 }, 0)).toBe('test');
    expect(isPendingFeedback({ type: 'star', testMode: true, timestamp: 10 }, 0)).toBe(false);
  });

  it('treats real events after the cutoff as pending and the rest as incorporated', () => {
    expect(feedbackStatus({ type: 'star', timestamp: 10 }, 5)).toBe('pending');
    expect(feedbackStatus({ type: 'star', timestamp: 5 }, 5)).toBe('incorporated');
  });
});
