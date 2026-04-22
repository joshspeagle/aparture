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
