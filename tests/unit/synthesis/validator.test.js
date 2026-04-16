import { describe, it, expect } from 'vitest';
import { validateCitations } from '../../../lib/synthesis/validator.js';

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
