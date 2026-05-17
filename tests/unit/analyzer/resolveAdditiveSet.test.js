import { describe, it, expect } from 'vitest';
import { resolveAdditiveSet } from '../../../lib/analyzer/resolveAdditiveSet.js';

const mkPaper = (id, score) => ({ id, arxivId: id, relevanceScore: score, title: `paper-${id}` });

describe('resolveAdditiveSet', () => {
  it('top-N when stars and dismisses are empty', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9), mkPaper('c', 8), mkPaper('d', 7)];
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(),
      dismissedIds: new Set(),
    });
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('adds starred papers outside top-N', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9), mkPaper('c', 8), mkPaper('d', 7)];
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(['d']),
      dismissedIds: new Set(),
    });
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b', 'd']);
  });
  it('removes dismissed papers from top-N', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9), mkPaper('c', 8)];
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(),
      dismissedIds: new Set(['a']),
    });
    expect(out.map((p) => p.id)).toEqual(['b']);
  });
  it('star on a paper already in top-N is a no-op', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9)];
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(['a']),
      dismissedIds: new Set(),
    });
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('dismiss on a paper not in top-N is a no-op', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9), mkPaper('c', 8)];
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(),
      dismissedIds: new Set(['c']),
    });
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('combined: dismisses one from top-N, stars another outside', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9), mkPaper('c', 8), mkPaper('d', 7)];
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(['d']),
      dismissedIds: new Set(['a']),
    });
    expect(out.map((p) => p.id).sort()).toEqual(['b', 'd']);
  });
  it('dismiss all top-N + star nothing → empty array', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9)];
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(),
      dismissedIds: new Set(['a', 'b']),
    });
    expect(out).toEqual([]);
  });
  it('empty availablePapers → empty array', () => {
    const out = resolveAdditiveSet({
      availablePapers: [],
      maxDeepAnalysis: 5,
      starredIds: new Set(['a']),
      dismissedIds: new Set(),
    });
    expect(out).toEqual([]);
  });
  it('starred and dismissed sets overlapping → dismissal wins (paper excluded)', () => {
    const papers = [mkPaper('a', 10), mkPaper('b', 9), mkPaper('c', 8)];
    // Paper 'c' is both starred (promotion candidate) and dismissed
    const out = resolveAdditiveSet({
      availablePapers: papers,
      maxDeepAnalysis: 2,
      starredIds: new Set(['c']),
      dismissedIds: new Set(['c']),
    });
    // c gets promoted then immediately stripped — final set is top-N only
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
});
