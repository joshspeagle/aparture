import { describe, it, expect } from 'vitest';
import {
  validateBriefingV2,
  normalizeForQuote,
  applyProposalEdit,
} from '../../../../lib/briefing/v2/validate.js';

const TEXT =
  'We find that the hierarchical model recovers the population mean to within 3 per cent ' +
  'across all mock catalogues, while the naive stacking estimator is biased by $\\sim 15$ per cent.';

function briefing(overrides = {}) {
  return {
    version: 2,
    date: '2026-10-17',
    headline: 'Hierarchical models earn their keep',
    lede: 'One paper today.\n\nIt matters.',
    readFirst: { id: '2610.00001', why: 'Because.' },
    themes: [{ title: 'Population inference', argument: 'An argument.', paperIds: ['2610.00001'] }],
    papers: [
      {
        id: '2610.00001',
        title: 'Hierarchical Inference for Galaxy Populations',
        authors: 'A. Author et al.',
        tier: 'read',
        score: 7.9,
        pitch: 'A pitch.',
        whyYou: 'Your profile names hierarchical Bayes.',
        result: {
          text: 'Recovers the mean to 3 per cent.',
          quote:
            'the hierarchical model recovers the population mean to within 3 per cent across all mock catalogues',
        },
        method: 'A method.',
        caveat: 'Mocks only.',
        figure: { id: 'S2.F1', caption: 'The recovery.' },
        readingMinutes: 30,
        because: null,
        becauseRefs: [],
      },
    ],
    nearMisses: [{ id: '2610.00002', line: 'Close but not quite.' }],
    notes: { learned: '', questions: [], proposals: [] },
    ...overrides,
  };
}

const ctx = (overrides = {}) => ({
  readIds: new Set(['2610.00001']),
  nearMissPool: new Set(['2610.00001', '2610.00002']),
  titles: new Map([['2610.00001', 'Hierarchical inference for galaxy populations']]),
  paperText: new Map([['2610.00001', TEXT]]),
  figureIds: new Map([['2610.00001', new Set(['S2.F1'])]]),
  feedbackRefs: new Set(['2610.09999', 'comment 2026-10-15']),
  targets: { profile: 'I work on hierarchical Bayesian models.', learned: '' },
  ...overrides,
});

describe('validateBriefingV2', () => {
  it('passes a grounded briefing and counts what it checked', () => {
    const r = validateBriefingV2(briefing(), ctx());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.stats).toMatchObject({ papers: 1, quotesChecked: 1, citationsChecked: 2 });
  });

  it('rejects schema violations with a path', () => {
    const r = validateBriefingV2(briefing({ headline: '' }), ctx());
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/^schema: headline/);
  });

  it('rejects a paper outside the reading set and a near miss from outside the harvest', () => {
    const b = briefing({ nearMisses: [{ id: '2610.77777', line: 'x' }] });
    const r = validateBriefingV2(b, ctx({ readIds: new Set() }));
    expect(r.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/papers\[2610.00001\]: not in the reading set/),
        expect.stringMatching(/nearMisses\[2610.77777\]: not a triaged YES\/MAYBE/),
      ])
    );
  });

  it('rejects a quote that is not verbatim in the paper text', () => {
    const b = briefing();
    b.papers[0].result.quote =
      'the hierarchical model recovers the population mean to within 2 per cent across all mock catalogues';
    const r = validateBriefingV2(b, ctx());
    expect(r.errors).toContain(
      'papers[2610.00001].result.quote: not found verbatim in the paper text'
    );
  });

  it('tolerates whitespace and typographic quote differences in a faithful copy', () => {
    expect(normalizeForQuote('the naive  stacking’s estimator — biased')).toBe(
      normalizeForQuote("the naive stacking's estimator - biased")
    );
  });

  it('rejects unknown figures, theme ids, and feedback claims without matching events', () => {
    const b = briefing();
    b.papers[0].figure = { id: 'S9.F9', caption: 'x' };
    b.papers[0].because = 'You starred a similar paper.';
    b.papers[0].becauseRefs = ['2610.12345'];
    b.themes[0].paperIds.push('2610.55555');
    const r = validateBriefingV2(b, ctx());
    expect(r.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/figure: S9.F9 is not one of this paper's figures/),
        expect.stringMatching(/becauseRefs: "2610.12345" is not in the reader's feedback/),
        expect.stringMatching(/themes\[0\]: cites 2610.55555/),
      ])
    );
  });

  it('checks proposal anchors against the target file', () => {
    const b = briefing({
      notes: {
        learned: '',
        questions: [],
        proposals: [
          {
            id: 'p1',
            target: 'profile',
            edit: { type: 'insert', anchor: 'hierarchical Bayesian models', content: ' for SBI' },
            rationale: 'Two stars.',
            evidence: ['2610.09999'],
          },
          {
            id: 'p2',
            target: 'profile',
            edit: { type: 'replace', anchor: 'text that is not there', content: 'y' },
            rationale: 'x',
            evidence: ['comment 2026-10-15'],
          },
        ],
      },
    });
    const r = validateBriefingV2(b, ctx());
    expect(r.errors).toEqual(['notes.proposals[p2]: anchor not found verbatim in profile']);
  });
});

describe('applyProposalEdit', () => {
  const text = 'I like A. I like B.';
  it('inserts after, replaces, and deletes the anchor', () => {
    expect(
      applyProposalEdit(text, { type: 'insert', anchor: 'I like A.', content: ' And C.' })
    ).toBe('I like A. And C. I like B.');
    expect(applyProposalEdit(text, { type: 'replace', anchor: 'B', content: 'D' })).toBe(
      'I like A. I like D.'
    );
    expect(applyProposalEdit(text, { type: 'delete', anchor: ' I like B.', content: '' })).toBe(
      'I like A.'
    );
  });
  it('returns null when the anchor no longer matches', () => {
    expect(applyProposalEdit(text, { type: 'replace', anchor: 'Z', content: 'y' })).toBeNull();
  });
});
