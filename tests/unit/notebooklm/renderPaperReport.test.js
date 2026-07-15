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

  it('falls back to paper.id when arxivId is absent (pipeline finalRanking shape)', () => {
    // Pipeline papers in `results.finalRanking` come straight from the arxiv
    // module's Paper type, which uses `id` not `arxivId`. The renderer must
    // accept either, otherwise the notebookLM bundle ships `arXiv: undefined`.
    const pipelinePaper = {
      id: '2604.25786',
      title: 'Some paper',
      finalScore: 9.5,
      scoreJustification: 'Test.',
    };
    const { filename, content } = renderPaperReport(pipelinePaper, 1);
    expect(content).toContain('**arXiv:** 2604.25786');
    expect(filename).toContain('2604.25786');
    expect(content).not.toContain('undefined');
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

  it('sanitizes the slash in old-style arXiv ids for the ZIP entry name', () => {
    const oldStyle = {
      arxivId: 'astro-ph/0601001',
      title: 'An old-style identifier paper',
      finalScore: 8.0,
      scoreJustification: 'Classic.',
    };
    const { filename, content } = renderPaperReport(oldStyle, 2);
    // Filename must stay flat under papers/ — no nested folder from the '/'.
    expect(filename).toBe('papers/02-astro-ph-0601001-an-old-style-identifier-paper.md');
    expect(filename.match(/\//g)).toHaveLength(1); // only the papers/ separator
    // The report body keeps the REAL id.
    expect(content).toContain('**arXiv:** astro-ph/0601001');
  });
});
