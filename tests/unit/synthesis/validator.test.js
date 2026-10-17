import { describe, it, expect } from 'vitest';
import {
  validateBriefing,
  validateCitations,
  validateCoverage,
  validateProseIds,
  normalizeBriefing,
  salvageBriefing,
  OTHER_PAPERS_THEME,
  UNVERIFIED_ID_PLACEHOLDER,
} from '../../../lib/synthesis/validator.js';

const inputPaperIds = ['2504.01234', '2504.02345', '2504.03456'];

describe('validateCitations', () => {
  it('returns ok for a briefing with valid citations', () => {
    const briefing = {
      papers: inputPaperIds.map((id) => ({ arxivId: id })),
      themes: [{ paperIds: ['2504.01234'] }],
    };
    const result = validateCitations(briefing, inputPaperIds);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags a paper in a theme that is not in the input list', () => {
    const briefing = {
      papers: [{ arxivId: '2504.01234' }],
      themes: [{ paperIds: ['2504.99999'] }],
    };
    const result = validateCitations(briefing, inputPaperIds);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('2504.99999'))).toBe(true);
  });

  it('flags a paper card whose arxivId is not in the input list', () => {
    const briefing = {
      papers: [{ arxivId: '2504.88888' }],
      themes: [],
    };
    const result = validateCitations(briefing, inputPaperIds);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('2504.88888'))).toBe(true);
  });
});

// The input the route actually sees (mapFinalRankingToBriefingPapers shape).
const INPUT = [
  { arxivId: '2610.00001', title: 'Conditional Mean Flows', score: 8.4 },
  {
    arxivId: '2610.00002',
    title: 'An Attenuation Bump at z = 9.3',
    score: 7.1,
    engagement: { starred: true, dismissed: false },
  },
  { arxivId: '2610.00003', title: 'The Pristine survey XXIX', score: 5.0 },
];

const card = (arxivId, extra = {}) => ({
  arxivId,
  title: INPUT.find((p) => p.arxivId === arxivId)?.title ?? 'Some title',
  score: INPUT.find((p) => p.arxivId === arxivId)?.score ?? 5,
  onelinePitch: `Pitch for ${arxivId}.`,
  whyMatters: `Why ${arxivId} matters.`,
  ...extra,
});

const goodBriefing = () => ({
  executiveSummary: 'If you read one paper today, make it 2610.00002 because of the bump.',
  themes: [
    { title: 'Fast inference', argument: 'Mean flows (2610.00001).', paperIds: ['2610.00001'] },
    {
      title: 'Early enrichment',
      argument: 'Both ends of cosmic time.',
      paperIds: ['2610.00002', '2610.00003'],
    },
  ],
  papers: [card('2610.00001'), card('2610.00002'), card('2610.00003')],
});

describe('validateBriefing — strengthened checks', () => {
  it('accepts a briefing that covers every input exactly once, themed, with real ids in prose', () => {
    expect(validateBriefing(goodBriefing(), INPUT)).toEqual({ ok: true, errors: [] });
  });

  it('still accepts bare id lists (legacy callers) and returns exactly {ok, errors}', () => {
    expect(
      validateBriefing(
        goodBriefing(),
        INPUT.map((p) => p.arxivId)
      )
    ).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('(a) rejects a dropped input paper', () => {
    const b = goodBriefing();
    b.papers = b.papers.filter((p) => p.arxivId !== '2610.00003');
    b.themes[1].paperIds = ['2610.00002'];
    const result = validateBriefing(b, INPUT);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'input paper "2610.00003" has no card in papers (every final-round paper needs exactly one)'
    );
  });

  it('(a) rejects duplicate cards for one paper', () => {
    const b = goodBriefing();
    b.papers.push(card('2610.00001', { onelinePitch: 'Another pitch.' }));
    const result = validateBriefing(b, INPUT);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /"2610\.00001" has 2 cards/.test(e))).toBe(true);
  });

  it('(a) lets the model omit a dismissed paper, but not list it in a theme without a card', () => {
    const input = INPUT.map((p) =>
      p.arxivId === '2610.00003' ? { ...p, engagement: { starred: false, dismissed: true } } : p
    );
    const b = goodBriefing();
    b.papers = b.papers.filter((p) => p.arxivId !== '2610.00003');
    expect(validateBriefing(b, input).ok).toBe(false); // still listed in theme 2
    b.themes[1].paperIds = ['2610.00002'];
    expect(validateBriefing(b, input)).toEqual({ ok: true, errors: [] });
  });

  it('(c) rejects a card that is in no theme (it would never render)', () => {
    const b = goodBriefing();
    b.themes[1].paperIds = ['2610.00002'];
    const result = validateBriefing(b, INPUT);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'paper "2610.00003" is not in any theme (its card would never be shown)'
    );
  });

  it('(c) rejects zero themes when there are cards', () => {
    const b = goodBriefing();
    b.themes = [];
    const result = validateBriefing(b, INPUT);
    expect(result.ok).toBe(false);
    expect(result.errors.filter((e) => /not in any theme/.test(e))).toHaveLength(3);
  });

  it('(d) calls out a starred paper with no card', () => {
    const b = goodBriefing();
    b.papers = b.papers.filter((p) => p.arxivId !== '2610.00002');
    b.themes[1].paperIds = ['2610.00003'];
    const result = validateBriefing(b, INPUT);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'starred paper "2610.00002" has no card in papers (every starred paper must be featured)'
    );
  });

  it('(e) rejects an arXiv id in prose that is not an input paper', () => {
    const b = goodBriefing();
    b.executiveSummary = 'If you read one paper today, make it 2610.99999 because it settles it.';
    b.themes[0].argument = 'As arXiv:2611.12345v2 showed, the bound is tight.';
    const result = validateBriefing(b, INPUT);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'executiveSummary mentions arXiv id "2610.99999", which is not in today\'s input'
    );
    expect(result.errors).toContain(
      'themes[0].argument mentions arXiv id "2611.12345", which is not in today\'s input'
    );
  });
});

describe('validateProseIds', () => {
  const ids = ['2610.00001'];
  const proseOnly = (text) => ({ executiveSummary: text, themes: [], papers: [] });

  it('accepts input ids with a version suffix or arXiv: prefix', () => {
    expect(validateProseIds(proseOnly('See arXiv:2610.00001v3.'), ids).ok).toBe(true);
  });

  it('does not mistake decimals for ids (the YYMM part is range-checked)', () => {
    const text =
      'The 21 cm line sits at 1420.4058 MHz; the bump is at 2132.17 Angstroms; z = 9.3335; ' +
      'a value of 2013.12345 is not a month either.';
    expect(validateProseIds(proseOnly(text), ids)).toEqual({ ok: true, errors: [] });
  });

  it('catches old-style 4-digit ids too', () => {
    const result = validateProseIds(proseOnly('This revisits 1412.6980.'), ids);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/"1412\.6980"/);
  });

  it('checks card prose as well as the summary and themes', () => {
    const b = {
      executiveSummary: 'ok',
      themes: [],
      papers: [{ arxivId: '2610.00001', onelinePitch: 'ok', whyMatters: 'Extends 2501.00042.' }],
    };
    expect(validateProseIds(b, ids).errors).toEqual([
      'papers[2610.00001].whyMatters mentions arXiv id "2501.00042", which is not in today\'s input',
    ]);
  });
});

describe('validateCoverage', () => {
  it('does not double-report unknown ids (validateCitations owns those)', () => {
    const b = {
      papers: [{ arxivId: '2610.99999' }],
      themes: [{ title: 't', paperIds: ['2610.99999'] }],
    };
    const errors = validateCoverage(b, ['2610.99999x']).errors;
    expect(errors.some((e) => e.includes('2610.99999"'))).toBe(false);
  });
});

describe('normalizeBriefing — deterministic corrections', () => {
  it("overwrites a card's title and score from the input paper and reports it", () => {
    const b = goodBriefing();
    // The auditor's swap: a valid id carrying another paper's title and score.
    b.papers[0] = card('2610.00001', { title: 'The Pristine survey XXIX', score: 9.9 });
    const { briefing, corrections } = normalizeBriefing(b, INPUT);
    expect(briefing.papers[0].title).toBe('Conditional Mean Flows');
    expect(briefing.papers[0].score).toBe(8.4);
    expect(corrections).toHaveLength(2);
    expect(corrections[0]).toMatch(/title "The Pristine survey XXIX" replaced/);
    expect(corrections[1]).toMatch(/score 9\.9 replaced with the pipeline score 8\.4/);
    // Pure: the model output is not mutated.
    expect(b.papers[0].title).toBe('The Pristine survey XXIX');
  });

  it('fixes an out-of-range model score so the schema check does not fail on it', () => {
    const b = goodBriefing();
    b.papers[1] = card('2610.00002', { score: 11 });
    const { briefing } = normalizeBriefing(b, INPUT);
    expect(validateBriefing(briefing, INPUT)).toEqual({ ok: true, errors: [] });
  });

  it('treats whitespace-only title differences as no correction', () => {
    const input = [{ arxivId: '2610.00001', title: 'Conditional Mean\n  Flows', score: 8.4 }];
    const b = {
      executiveSummary: 'x',
      themes: [{ title: 't', argument: 'a', paperIds: ['2610.00001'] }],
      papers: [card('2610.00001', { title: 'Conditional Mean Flows' })],
    };
    const { briefing, corrections } = normalizeBriefing(b, input);
    expect(corrections).toEqual([]);
    expect(briefing.papers[0].title).toBe('Conditional Mean\n  Flows');
  });

  it('drops duplicate cards (first wins) and duplicate theme ids', () => {
    const b = goodBriefing();
    b.papers.push(card('2610.00003', { onelinePitch: 'Second copy.' }));
    b.themes[1].paperIds = ['2610.00002', '2610.00003', '2610.00002'];
    const { briefing, corrections } = normalizeBriefing(b, INPUT);
    expect(briefing.papers.filter((p) => p.arxivId === '2610.00003')).toHaveLength(1);
    expect(briefing.papers.find((p) => p.arxivId === '2610.00003').onelinePitch).toBe(
      'Pitch for 2610.00003.'
    );
    expect(briefing.themes[1].paperIds).toEqual(['2610.00002', '2610.00003']);
    expect(corrections).toHaveLength(2);
    expect(validateBriefing(briefing, INPUT).ok).toBe(true);
  });

  it('leaves malformed shapes for the schema check instead of throwing', () => {
    expect(normalizeBriefing(null, INPUT)).toEqual({ briefing: null, corrections: [] });
    const { briefing } = normalizeBriefing({ papers: 'nope', themes: [null] }, INPUT);
    expect(validateBriefing(briefing, INPUT).ok).toBe(false);
  });
});

describe('salvageBriefing — last resort after a failed repair', () => {
  it('strips fabrications and fills omissions so the result validates', () => {
    const b = {
      executiveSummary: 'If you read one paper today, make it 2610.99999.',
      themes: [
        { title: 'One', argument: 'Builds on 2611.11111.', paperIds: ['2610.00001', '2610.88888'] },
      ],
      papers: [card('2610.00001'), card('2610.00003'), card('2610.88888')],
    };
    const { briefing, actions } = salvageBriefing(b, INPUT);

    expect(validateBriefing(briefing, INPUT)).toEqual({ ok: true, errors: [] });
    // Fabricated card removed; the starred paper the model dropped gets a
    // labelled, code-written card rather than vanishing.
    expect(briefing.papers.map((p) => p.arxivId).sort()).toEqual([
      '2610.00001',
      '2610.00002',
      '2610.00003',
    ]);
    const added = briefing.papers.find((p) => p.arxivId === '2610.00002');
    expect(added.title).toBe('An Attenuation Bump at z = 9.3');
    expect(added.onelinePitch).toMatch(/Added by Aparture/);
    // Unthemed cards are grouped under the explicit "Other papers" theme.
    const other = briefing.themes.find((t) => t.title === OTHER_PAPERS_THEME.title);
    expect(other.paperIds.sort()).toEqual(['2610.00002', '2610.00003']);
    // Unknown prose ids are neutralized, not shown as if real.
    expect(briefing.executiveSummary).toBe(
      `If you read one paper today, make it ${UNVERIFIED_ID_PLACEHOLDER}.`
    );
    expect(briefing.themes[0].argument).toBe(`Builds on ${UNVERIFIED_ID_PLACEHOLDER}.`);
    expect(actions.length).toBeGreaterThan(0);
  });

  it('is a no-op on a briefing that already validates', () => {
    const { briefing, actions } = salvageBriefing(goodBriefing(), INPUT);
    expect(actions).toEqual([]);
    expect(briefing).toEqual(goodBriefing());
  });
});
