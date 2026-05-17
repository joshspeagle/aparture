import { describe, it, expect } from 'vitest';
import {
  renderSuggestPrompt,
  pairCommentsWithOverrides,
} from '../../../lib/profile/suggestPrompt.js';

describe('renderSuggestPrompt', () => {
  const template = `CURRENT PROFILE:
{{profile}}

FEEDBACK:
{{feedback}}

END`;

  it('substitutes profile placeholder', () => {
    const out = renderSuggestPrompt(template, {
      profile: 'I study flows.',
      events: [],
    });
    expect(out).toContain('CURRENT PROFILE:\nI study flows.');
  });

  it('formats stars in the FEEDBACK section', () => {
    const out = renderSuggestPrompt(template, {
      profile: 'p',
      events: [
        {
          type: 'star',
          arxivId: '2504.01234',
          paperTitle: 'Circuit analysis',
          quickSummary: 'mech interp paper',
          score: 9.2,
          briefingDate: '2026-04-10',
        },
      ],
    });
    expect(out).toContain('STARS (1):');
    expect(out).toContain('2504.01234');
    expect(out).toContain('Circuit analysis');
  });

  it('formats dismisses, paper-comments, and general-comments into distinct sections', () => {
    const out = renderSuggestPrompt(template, {
      profile: 'p',
      events: [
        {
          type: 'dismiss',
          arxivId: '2504.02345',
          paperTitle: 'Bench paper',
          quickSummary: 's',
          score: 6,
          briefingDate: '2026-04-10',
        },
        {
          type: 'paper-comment',
          arxivId: '2504.03456',
          paperTitle: 'Head paper',
          quickSummary: 's',
          score: 8,
          text: 'good angle',
          briefingDate: '2026-04-11',
        },
        { type: 'general-comment', text: 'too much theory', briefingDate: '2026-04-14' },
      ],
    });
    expect(out).toContain('DISMISSES (1):');
    expect(out).toContain('PER-PAPER COMMENTS (1):');
    expect(out).toContain('GENERAL COMMENTS (1):');
    expect(out).toContain('good angle');
    expect(out).toContain('too much theory');
  });

  it('omits sections with zero events instead of showing empty lists', () => {
    const out = renderSuggestPrompt(template, { profile: 'p', events: [] });
    expect(out).not.toContain('STARS');
    expect(out).not.toContain('DISMISSES');
    expect(out).toContain('FEEDBACK:');
  });
});

describe('renderSuggestPrompt — new scoped-feedback sections', () => {
  const baseTemplate = 'PROFILE:\n{{profile}}\n\nFEEDBACK:\n{{feedback}}';
  const profile = 'P';

  it('emits BUCKET-LEVEL OBSERVATIONS section when bucket events present', () => {
    const events = [
      {
        id: '1',
        type: 'scoped-feedback',
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'too narrow',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
    ];
    const out = renderSuggestPrompt(baseTemplate, { profile, events, briefings: {} });
    expect(out).toMatch(/BUCKET-LEVEL OBSERVATIONS \(1\):/);
    expect(out).toMatch(/YES/);
    expect(out).toMatch(/too narrow/);
  });

  it('emits SCORE-REVIEW NOTES section when score-review events present', () => {
    const events = [
      {
        id: '1',
        type: 'scoped-feedback',
        scope: { kind: 'score-review' },
        text: 'compressed',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
    ];
    const out = renderSuggestPrompt(baseTemplate, { profile, events, briefings: {} });
    expect(out).toMatch(/SCORE-REVIEW NOTES \(1\):/);
    expect(out).toMatch(/compressed/);
  });

  it('emits RUN-LEVEL OBSERVATIONS section when run events present', () => {
    const events = [
      {
        id: '1',
        type: 'scoped-feedback',
        scope: { kind: 'run' },
        text: 'too aggressive',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
    ];
    const out = renderSuggestPrompt(baseTemplate, { profile, events, briefings: {} });
    expect(out).toMatch(/RUN-LEVEL OBSERVATIONS \(1\):/);
    expect(out).toMatch(/too aggressive/);
  });

  it('omits empty sections (no events of a kind → no section header)', () => {
    const events = [
      {
        id: '1',
        type: 'scoped-feedback',
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'x',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
    ];
    const out = renderSuggestPrompt(baseTemplate, { profile, events, briefings: {} });
    expect(out).not.toMatch(/SCORE-REVIEW NOTES/);
    expect(out).not.toMatch(/RUN-LEVEL OBSERVATIONS/);
  });

  it('section order: STARS, DISMISSES, PER-PAPER COMMENTS, GENERAL COMMENTS, FILTER OVERRIDES, BUCKET-LEVEL, SCORE-REVIEW, RUN-LEVEL', () => {
    const samplePaper = { arxivId: '2511.0001', paperTitle: 'P' };
    // paper-comment uses a different arxivId so it stays standalone (does not pair with the filter-override)
    const events = [
      { id: '1', type: 'star', ...samplePaper, briefingDate: '2026-05-17', timestamp: 1 },
      { id: '2', type: 'dismiss', ...samplePaper, briefingDate: '2026-05-17', timestamp: 2 },
      {
        id: '3',
        type: 'paper-comment',
        arxivId: '2511.0002',
        paperTitle: 'Q',
        text: 'c',
        briefingDate: '2026-05-17',
        timestamp: 3,
      },
      { id: '4', type: 'general-comment', text: 'g', briefingDate: '2026-05-17', timestamp: 4 },
      {
        id: '5',
        type: 'filter-override',
        ...samplePaper,
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 5,
      },
      {
        id: '6',
        type: 'scoped-feedback',
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'b',
        briefingDate: '2026-05-17',
        timestamp: 6,
      },
      {
        id: '7',
        type: 'scoped-feedback',
        scope: { kind: 'score-review' },
        text: 's',
        briefingDate: '2026-05-17',
        timestamp: 7,
      },
      {
        id: '8',
        type: 'scoped-feedback',
        scope: { kind: 'run' },
        text: 'r',
        briefingDate: '2026-05-17',
        timestamp: 8,
      },
    ];
    const out = renderSuggestPrompt(baseTemplate, { profile, events, briefings: {} });
    const order = [
      'STARS',
      'DISMISSES',
      'PER-PAPER COMMENTS',
      'GENERAL COMMENTS',
      'FILTER OVERRIDES',
      'BUCKET-LEVEL OBSERVATIONS',
      'SCORE-REVIEW NOTES',
      'RUN-LEVEL OBSERVATIONS',
    ];
    const positions = order.map((h) => out.indexOf(h));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});

describe('pairCommentsWithOverrides', () => {
  it('pairs single comment with single override on same (arxivId, briefingDate)', () => {
    const events = [
      {
        id: '1',
        type: 'paper-comment',
        arxivId: '2511.0001',
        text: 'rationale',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'filter-override',
        arxivId: '2511.0001',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
    ];
    const { pairedOverrides, standaloneComments, standaloneOverrides } =
      pairCommentsWithOverrides(events);
    expect(pairedOverrides).toHaveLength(1);
    expect(pairedOverrides[0].override.id).toBe('2');
    expect(pairedOverrides[0].comments).toHaveLength(1);
    expect(pairedOverrides[0].comments[0].id).toBe('1');
    expect(standaloneComments).toHaveLength(0);
    expect(standaloneOverrides).toHaveLength(0);
  });

  it('includes ALL comments inline under the override (multi-comment, chronological)', () => {
    const events = [
      {
        id: '1',
        type: 'paper-comment',
        arxivId: '2511.0001',
        text: 'first',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'paper-comment',
        arxivId: '2511.0001',
        text: 'second',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
      {
        id: '3',
        type: 'filter-override',
        arxivId: '2511.0001',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 3,
      },
    ];
    const { pairedOverrides } = pairCommentsWithOverrides(events);
    expect(pairedOverrides[0].comments).toHaveLength(2);
    expect(pairedOverrides[0].comments[0].text).toBe('first');
    expect(pairedOverrides[0].comments[1].text).toBe('second');
  });

  it('uses most recent override when multi-override on same key; earlier override unpaired', () => {
    const events = [
      {
        id: '1',
        type: 'paper-comment',
        arxivId: '2511.0001',
        text: 'c',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'filter-override',
        arxivId: '2511.0001',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
      {
        id: '3',
        type: 'filter-override',
        arxivId: '2511.0001',
        originalVerdict: 'YES',
        newVerdict: 'MAYBE',
        briefingDate: '2026-05-17',
        timestamp: 3,
      },
    ];
    const { pairedOverrides, standaloneOverrides } = pairCommentsWithOverrides(events);
    expect(pairedOverrides).toHaveLength(1);
    expect(pairedOverrides[0].override.id).toBe('3');
    expect(standaloneOverrides).toHaveLength(1);
    expect(standaloneOverrides[0].id).toBe('2');
  });

  it('comments without override stay in standaloneComments', () => {
    const events = [
      {
        id: '1',
        type: 'paper-comment',
        arxivId: '2511.0001',
        text: 'c',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
    ];
    const { pairedOverrides, standaloneComments } = pairCommentsWithOverrides(events);
    expect(pairedOverrides).toHaveLength(0);
    expect(standaloneComments).toHaveLength(1);
  });

  it('overrides without comment stay in standaloneOverrides', () => {
    const events = [
      {
        id: '1',
        type: 'filter-override',
        arxivId: '2511.0001',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
    ];
    const { pairedOverrides, standaloneOverrides } = pairCommentsWithOverrides(events);
    expect(pairedOverrides).toHaveLength(0);
    expect(standaloneOverrides).toHaveLength(1);
  });

  it('different briefingDates do not pair', () => {
    const events = [
      {
        id: '1',
        type: 'paper-comment',
        arxivId: '2511.0001',
        text: 'c',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'filter-override',
        arxivId: '2511.0001',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-18',
        timestamp: 2,
      },
    ];
    const { pairedOverrides, standaloneComments, standaloneOverrides } =
      pairCommentsWithOverrides(events);
    expect(pairedOverrides).toHaveLength(0);
    expect(standaloneComments).toHaveLength(1);
    expect(standaloneOverrides).toHaveLength(1);
  });
});

describe('renderFeedbackSection — pairing integration', () => {
  const baseTemplate = 'P\n{{profile}}\n\nF\n{{feedback}}';

  it('renders paired override + comments inline in FILTER OVERRIDES, omits paired comments from PER-PAPER COMMENTS', () => {
    const events = [
      {
        id: '1',
        type: 'paper-comment',
        arxivId: '2511.0001',
        text: 'wrong justification',
        briefingDate: '2026-05-17',
        timestamp: 1,
      },
      {
        id: '2',
        type: 'filter-override',
        arxivId: '2511.0001',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-05-17',
        timestamp: 2,
      },
    ];
    const out = renderSuggestPrompt(baseTemplate, { profile: '', events, briefings: {} });
    expect(out).not.toMatch(/PER-PAPER COMMENTS/);
    expect(out).toMatch(/FILTER OVERRIDES \(1, with rationale/);
    expect(out).toMatch(/overrode NO → YES, with comments:/);
    expect(out).toMatch(/"wrong justification"/);
  });
});
