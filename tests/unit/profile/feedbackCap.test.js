import { describe, it, expect } from 'vitest';
import { applyCap } from '../../../lib/profile/feedbackCap.js';

const makeEvent = (type, timestamp) => ({
  id: `${type}-${timestamp}`,
  type,
  timestamp,
});

describe('applyCap', () => {
  it('returns all events when under threshold', () => {
    const events = [
      makeEvent('star', 1),
      makeEvent('dismiss', 2),
      makeEvent('paper-comment', 3),
      makeEvent('general-comment', 4),
    ];
    const { kept, dropped, stats } = applyCap(events, { commentCap: 30 });
    expect(kept).toHaveLength(4);
    expect(dropped).toHaveLength(0);
    expect(stats.starCount).toBe(1);
    expect(stats.dismissCount).toBe(1);
  });

  it('always keeps all stars and dismisses regardless of count', () => {
    const events = [];
    for (let i = 0; i < 100; i += 1) events.push(makeEvent('star', i));
    for (let i = 0; i < 100; i += 1) events.push(makeEvent('dismiss', 1000 + i));
    const { kept, dropped } = applyCap(events, { commentCap: 10 });
    expect(kept).toHaveLength(200);
    expect(dropped).toHaveLength(0);
  });

  it('caps paper-comments at the most recent commentCap entries', () => {
    const events = [];
    for (let i = 0; i < 50; i += 1) events.push(makeEvent('paper-comment', i));
    const { kept, dropped, stats } = applyCap(events, { commentCap: 10 });
    const keptComments = kept.filter((e) => e.type === 'paper-comment');
    expect(keptComments).toHaveLength(10);
    expect(keptComments[0].timestamp).toBeGreaterThanOrEqual(40);
    expect(dropped).toHaveLength(40);
    expect(stats.paperCommentTotal).toBe(50);
    expect(stats.paperCommentKept).toBe(10);
  });

  it('caps general-comments independently from paper-comments', () => {
    const events = [];
    for (let i = 0; i < 50; i += 1) events.push(makeEvent('general-comment', i));
    const { kept } = applyCap(events, { commentCap: 5 });
    expect(kept).toHaveLength(5);
  });

  it('reports trimmed true when anything was dropped', () => {
    const events = [];
    for (let i = 0; i < 50; i += 1) events.push(makeEvent('paper-comment', i));
    const { stats } = applyCap(events, { commentCap: 10 });
    expect(stats.trimmed).toBe(true);
  });

  it('reports trimmed false when nothing was dropped', () => {
    const events = [makeEvent('star', 1), makeEvent('paper-comment', 2)];
    const { stats } = applyCap(events, { commentCap: 30 });
    expect(stats.trimmed).toBe(false);
  });
});
