import { describe, it, expect } from 'vitest';
import { renderPaperReport } from '../../../lib/notebooklm/renderPaperReport.js';

const paper = {
  arxivId: '2504.01234',
  title: 'Circuit-level analysis of reasoning',
  finalScore: 9.2,
  scoreJustification: 'Directly engages your stated interest in interpretability.',
  deepAnalysis: {
    summary: 'The paper introduces a circuit-analysis framework...',
  },
};

describe('renderPaperReport', () => {
  it('returns a filename and markdown content for a paper', () => {
    const { filename, content } = renderPaperReport(paper, 1);
    expect(filename).toBe('papers/01-2504.01234-circuit-level-analysis-of-reasoning.md');
    expect(content).toContain('# [P1] Circuit-level analysis of reasoning');
    expect(content).toContain('**arXiv:** 2504.01234');
    expect(content).toContain('**Score:** 9.2/10');
    expect(content).toContain('**Relevance:** Directly engages');
    expect(content).toContain('The paper introduces a circuit-analysis framework...');
  });

  it('zero-pads indices to two digits and truncates long slugs to 60 chars', () => {
    const longTitle = {
      ...paper,
      title:
        'A very long title that keeps going and going and definitely exceeds sixty characters by a wide margin',
    };
    const { filename } = renderPaperReport(longTitle, 9);
    expect(filename).toMatch(/^papers\/09-2504\.01234-/);
    const slug = filename.split('-').slice(2).join('-').replace(/\.md$/, '');
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it('falls back to relevanceScore if finalScore is missing', () => {
    const noDeep = {
      arxivId: '2504.09999',
      title: 'Abstract only',
      relevanceScore: 7.5,
      scoreJustification: 'Partial match.',
    };
    const { content } = renderPaperReport(noDeep, 3);
    expect(content).toContain('**Score:** 7.5/10');
    expect(content).toContain('No deep analysis available for this paper.');
  });
});
