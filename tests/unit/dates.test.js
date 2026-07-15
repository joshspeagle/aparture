import { describe, it, expect } from 'vitest';
import { localDateStr } from '../../lib/dates.js';

describe('localDateStr', () => {
  it('formats a date as YYYY-MM-DD using LOCAL components', () => {
    // Construct via local components so the expectation is timezone-proof.
    expect(localDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('pads single-digit month and day', () => {
    expect(localDateStr(new Date(2026, 8, 3))).toBe('2026-09-03');
  });

  it('defaults to now', () => {
    const now = new Date();
    expect(localDateStr()).toBe(localDateStr(now));
  });

  it('uses the local calendar day, not the UTC one, near midnight', () => {
    // 23:30 local on Jan 5. In any UTC+ timezone, toISOString() has already
    // rolled to Jan 6 UTC... actually the reverse: in UTC+ zones local
    // midnight converts BACK to the previous UTC day. Either way, the local
    // formatter must report the local day regardless of offset.
    const lateLocal = new Date(2026, 0, 5, 23, 30, 0);
    expect(localDateStr(lateLocal)).toBe('2026-01-05');
    const earlyLocal = new Date(2026, 0, 5, 0, 10, 0);
    expect(localDateStr(earlyLocal)).toBe('2026-01-05');
    // Contrast with the old idiom: in a non-UTC zone at least one of these
    // two instants disagrees with toISOString().slice(0, 10). We can't force
    // a timezone here, so just assert the local formatter is self-consistent.
    expect(localDateStr(lateLocal)).toBe(localDateStr(earlyLocal));
  });
});
