import { describe, it, expect } from 'vitest';
import { renderSuggestPrompt } from '../../../lib/profile/suggestPrompt.js';

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
