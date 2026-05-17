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

describe('applyCap — scoped-feedback passthrough', () => {
  it('passes scoped-feedback events through uncapped', () => {
    const events = [
      { id: '1', type: 'star', arxivId: 'a', timestamp: 1 },
      {
        id: '2',
        type: 'scoped-feedback',
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'yes-note',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
      {
        id: '3',
        type: 'scoped-feedback',
        scope: { kind: 'score-review' },
        text: 'score-note',
        briefingDate: '2026-05-17',
        timestamp: 3,
      },
      {
        id: '4',
        type: 'scoped-feedback',
        scope: { kind: 'run' },
        text: 'run-note',
        briefingDate: '2026-05-17',
        timestamp: 4,
      },
    ];
    const { kept } = applyCap(events);
    const keptIds = kept.map((e) => e.id).sort();
    expect(keptIds).toEqual(['1', '2', '3', '4']);
  });

  it('exposes a scopedFeedback count in stats', () => {
    const events = [
      {
        id: '1',
        type: 'scoped-feedback',
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 't',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'scoped-feedback',
        scope: { kind: 'run' },
        text: 't',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
    ];
    const { stats } = applyCap(events);
    expect(stats.scopedFeedback).toBe(2);
  });
});

describe('applyCap — filter-override passthrough', () => {
  it('passes filter-override events through uncapped', () => {
    const events = [
      { id: '1', type: 'star', arxivId: 'a', timestamp: 1 },
      {
        id: '2',
        type: 'filter-override',
        arxivId: 'b',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
    ];
    const { kept } = applyCap(events);
    expect(kept.map((e) => e.id).sort()).toEqual(['1', '2']);
  });

  it('exposes a filterOverride count in stats', () => {
    const events = [
      {
        id: '1',
        type: 'filter-override',
        arxivId: 'a',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'filter-override',
        arxivId: 'b',
        originalVerdict: 'YES',
        newVerdict: 'NO',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
    ];
    const { stats } = applyCap(events);
    expect(stats.filterOverride).toBe(2);
  });
});
