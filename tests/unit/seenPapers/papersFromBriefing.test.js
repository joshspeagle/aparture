import { describe, it, expect } from 'vitest';
import { papersFromBriefing } from '../../../lib/seenPapers/papersFromBriefing.js';

describe('papersFromBriefing', () => {
  it('returns an empty array for null / missing input', () => {
    expect(papersFromBriefing(null)).toEqual([]);
    expect(papersFromBriefing(undefined)).toEqual([]);
    expect(papersFromBriefing({})).toEqual([]);
  });

  it('extracts briefed paper arxivIds', () => {
    const entry = {
      briefing: {
        papers: [{ arxivId: '2605.14205' }, { arxivId: '2605.14210' }],
      },
    };
    const ids = papersFromBriefing(entry).map((p) => p.id);
    expect(ids.sort()).toEqual(['2605.14205', '2605.14210']);
  });

  it('extracts filterResults yes/maybe/no buckets when pipelineArchive present', () => {
    const entry = {
      briefing: { papers: [] },
      pipelineArchive: {
        filterResults: {
          yes: [{ id: 'y.1' }],
          maybe: [{ id: 'm.1' }],
          no: [{ id: 'n.1' }, { id: 'n.2' }],
        },
      },
    };
    const ids = papersFromBriefing(entry).map((p) => p.id);
    expect(ids.sort()).toEqual(['m.1', 'n.1', 'n.2', 'y.1']);
  });

  it('unions briefed papers + filterResults without duplicating ids', () => {
    const entry = {
      briefing: { papers: [{ arxivId: 'shared.1' }, { arxivId: 'briefed.1' }] },
      pipelineArchive: {
        filterResults: {
          yes: [{ id: 'shared.1' }, { id: 'filter.1' }],
          maybe: [],
          no: [],
        },
      },
    };
    const ids = papersFromBriefing(entry).map((p) => p.id);
    expect(ids.sort()).toEqual(['briefed.1', 'filter.1', 'shared.1']);
  });

  it('tolerates missing pipelineArchive (stripped under quota)', () => {
    const entry = {
      briefing: { papers: [{ arxivId: 'b.1' }] },
      // pipelineArchive omitted — happens when HEAVY_FIELDS were stripped
    };
    expect(papersFromBriefing(entry).map((p) => p.id)).toEqual(['b.1']);
  });

  it('returns nothing for test-mode (dry-run) briefings — they must not feed the dedupe index', () => {
    const entry = {
      generationMetadata: { testMode: true },
      briefing: { papers: [{ arxivId: 'real.1' }] },
      pipelineArchive: {
        filterResults: { yes: [{ id: 'y.1' }], maybe: [], no: [{ id: 'n.1' }] },
      },
    };
    expect(papersFromBriefing(entry)).toEqual([]);
  });

  it('skips entries with no id / arxivId field', () => {
    const entry = {
      briefing: { papers: [{ arxivId: 'real.1' }, { title: 'no id here' }] },
      pipelineArchive: {
        filterResults: {
          yes: [{ id: 'y.1' }, { title: 'missing id' }],
          maybe: [],
          no: [],
        },
      },
    };
    const ids = papersFromBriefing(entry).map((p) => p.id);
    expect(ids.sort()).toEqual(['real.1', 'y.1']);
  });
});
