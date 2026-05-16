import { describe, it, expect } from 'vitest';
import { applyDedupe } from '../../../lib/analyzer/applyDedupe.js';

const PAPERS = [
  { id: '2605.14205', title: 'A' },
  { id: '2605.14210', title: 'B' },
  { id: '2605.14211', title: 'C' },
  { id: '2605.14212', title: 'D' },
  { id: '2605.14213', title: 'E' },
];

describe('applyDedupe', () => {
  it('returns all papers unchanged when seenIndex is empty', () => {
    const res = applyDedupe(PAPERS, {}, true);
    expect(res.kept).toHaveLength(5);
    expect(res.matched).toBe(0);
    expect(res.mode).toBe('remove');
    expect(res.kept.every((p) => !p.isDuplicate)).toBe(true);
  });

  it('Remove mode: drops matched papers and reports count', () => {
    const seen = { '2605.14210': '2026-05-10', '2605.14213': '2026-04-01' };
    const res = applyDedupe(PAPERS, seen, true);
    expect(res.mode).toBe('remove');
    expect(res.matched).toBe(2);
    expect(res.kept).toHaveLength(3);
    expect(res.kept.map((p) => p.id).sort()).toEqual(['2605.14205', '2605.14211', '2605.14212']);
  });

  it('Flag mode: keeps all papers but decorates matched ones', () => {
    const seen = { '2605.14210': '2026-05-10', '2605.14213': '2026-04-01' };
    const res = applyDedupe(PAPERS, seen, false);
    expect(res.mode).toBe('flag');
    expect(res.matched).toBe(2);
    expect(res.kept).toHaveLength(5);
    const b = res.kept.find((p) => p.id === '2605.14210');
    const e = res.kept.find((p) => p.id === '2605.14213');
    expect(b.isDuplicate).toBe(true);
    expect(b.firstSeenDate).toBe('2026-05-10');
    expect(e.isDuplicate).toBe(true);
    expect(e.firstSeenDate).toBe('2026-04-01');
    // non-matched stay clean
    expect(res.kept.find((p) => p.id === '2605.14205').isDuplicate).toBeUndefined();
  });

  it('ignores reserved metadata keys (those starting with "_")', () => {
    const seen = { _migratedAt: 1, '2605.14210': '2026-05-10' };
    const res = applyDedupe(PAPERS, seen, true);
    expect(res.matched).toBe(1);
    expect(res.kept).toHaveLength(4);
  });

  it('skips papers without an id', () => {
    const seen = { '2605.14210': '2026-05-10' };
    const res = applyDedupe([{ title: 'no id here' }, ...PAPERS], seen, true);
    expect(res.matched).toBe(1);
    // Original count (5 + 1 no-id paper) minus 1 matched = 5
    expect(res.kept).toHaveLength(5);
  });

  it('does not mutate the input papers array', () => {
    const seen = { '2605.14210': '2026-05-10' };
    const input = PAPERS.slice();
    applyDedupe(input, seen, true);
    expect(input).toHaveLength(5);
    // input papers themselves should not gain isDuplicate (helper makes shallow copies)
    expect(input.every((p) => !p.isDuplicate)).toBe(true);
  });
});
