import { describe, it, expect } from 'vitest';
import { buildIndexEntry } from '../../../lib/briefing/buildIndexEntry.js';

describe('buildIndexEntry', () => {
  it('extracts the search-capable subset of a full entry', () => {
    const full = {
      id: 'abc',
      date: '2026-04-21',
      timestamp: 42,
      archived: false,
      briefing: {
        executiveSummary: 'summary text',
        themes: [{ title: 'DROPPED', argument: '…', paperIds: ['x'] }],
        papers: [
          {
            arxivId: '2504.01234',
            title: 'Paper A',
            score: 8.5,
            onelinePitch: 'DROPPED',
            whyMatters: 'DROPPED',
          },
          { arxivId: '2504.05678', title: 'Paper B', score: 6.0 },
        ],
      },
      pipelineArchive: { scoredPapers: [] },
      quickSummariesById: { '2504.01234': 'summary' },
      fullReportsById: { '2504.01234': 'report' },
    };

    expect(buildIndexEntry(full)).toEqual({
      id: 'abc',
      date: '2026-04-21',
      timestamp: 42,
      archived: false,
      briefing: {
        executiveSummary: 'summary text',
        papers: [
          { arxivId: '2504.01234', title: 'Paper A', score: 8.5 },
          { arxivId: '2504.05678', title: 'Paper B', score: 6.0 },
        ],
      },
    });
  });

  it('tolerates a missing briefing', () => {
    expect(buildIndexEntry({ id: 'a', date: '2026-04-21', timestamp: 0, archived: false })).toEqual(
      {
        id: 'a',
        date: '2026-04-21',
        timestamp: 0,
        archived: false,
        briefing: { executiveSummary: '', papers: [] },
      }
    );
  });

  it('marks dry-run and minimal-test briefings as test runs, and keeps the flag on re-derive', () => {
    const base = { id: 'c', date: '2026-04-21', timestamp: 0, archived: false, briefing: {} };
    const dry = buildIndexEntry({ ...base, generationMetadata: { testMode: true } });
    const minimal = buildIndexEntry({
      ...base,
      generationMetadata: { testMode: false, minimalTest: true },
    });
    const real = buildIndexEntry({ ...base, generationMetadata: { testMode: false } });
    expect(dry.testRun).toBe(true);
    expect(minimal.testRun).toBe(true);
    expect(real.testRun).toBeUndefined();
    // readStoredHistory re-runs buildIndexEntry on index entries, which carry
    // no generationMetadata — the flag must survive that.
    expect(buildIndexEntry(dry).testRun).toBe(true);
  });

  it('tolerates missing papers array', () => {
    const full = {
      id: 'b',
      date: '2026-04-21',
      timestamp: 0,
      archived: true,
      briefing: { executiveSummary: 'x' },
    };
    expect(buildIndexEntry(full).briefing.papers).toEqual([]);
  });
});
