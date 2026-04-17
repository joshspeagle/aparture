import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildReportMarkdown,
  downloadBlob,
  exportAnalysisReport as _exportAnalysisReport,
} from '../../../lib/analyzer/exportReport.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeConfig(overrides = {}) {
  return {
    selectedCategories: ['cs.AI', 'cs.LG'],
    maxDeepAnalysis: 5,
    useQuickFilter: true,
    filterModel: 'claude-haiku-4.5',
    scoringModel: 'claude-sonnet-4.6',
    pdfModel: 'claude-opus-4.6',
    ...overrides,
  };
}

function makeTiming(overrides = {}) {
  return {
    duration: 120000, // 2 minutes in ms
    startTime: new Date('2026-04-17T10:00:00Z'),
    ...overrides,
  };
}

function makePaper(overrides = {}) {
  return {
    id: '2504.12345',
    title: 'Attention Is All You Need',
    authors: ['Vaswani, A.', 'Shazeer, N.', 'Parmar, N.'],
    finalScore: 9.2,
    relevanceScore: 8.5,
    scoreJustification: 'Highly relevant to transformer architectures.',
    deepAnalysis: {
      relevanceAssessment: 'Directly relevant to attention mechanisms.',
      keyFindings: 'Multi-head attention outperforms RNNs.',
      methodology: 'Transformer architecture with self-attention.',
      limitations: 'Quadratic complexity with sequence length.',
      summary: 'The paper introduces the Transformer, a model architecture eschewing recurrence.',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildReportMarkdown — header content
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — header', () => {
  it('includes the screened and analyzed paper counts from results', () => {
    const paper = makePaper();
    const results = {
      scoredPapers: [paper, makePaper({ id: '2504.99999' })],
      finalRanking: [paper],
    };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('**Abstracts Screened:** 2');
    expect(out).toContain('**Papers Analyzed:** 2');
    expect(out).toContain('**Final Report:** 1');
  });

  it('includes the categories from config', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig({ selectedCategories: ['astro-ph.GA', 'gr-qc'] }),
    });
    expect(out).toContain('astro-ph.GA, gr-qc');
  });

  it('includes filterModel in Models Used when useQuickFilter is true', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig({ useQuickFilter: true, filterModel: 'claude-haiku-4.5' }),
    });
    expect(out).toContain('claude-haiku-4.5 (filter)');
  });

  it('omits filterModel in Models Used when useQuickFilter is false', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig({ useQuickFilter: false }),
    });
    expect(out).not.toContain('(filter)');
  });

  it('includes scoringModel and pdfModel in Models Used', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig({ scoringModel: 'gpt-5.4-mini', pdfModel: 'gemini-2.5-pro' }),
    });
    expect(out).toContain('gpt-5.4-mini (scoring)');
    expect(out).toContain('gemini-2.5-pro (PDF analysis)');
  });

  it('shows duration rounded to minutes', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: { duration: 150000 }, // 2.5 min → rounds to 3
      config: makeConfig(),
    });
    // Math.round(150000 / 60000) === 3
    expect(out).toContain('**Duration:** 3 minutes');
  });

  it('shows 0 minutes when duration is falsy', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: { duration: 0 },
      config: makeConfig(),
    });
    expect(out).toContain('**Duration:** 0 minutes');
  });

  it('contains the horizontal-rule separator after the header', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('---');
  });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — empty finalRanking
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — empty results', () => {
  it('returns valid markdown with the header but no paper sections', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });

    // Should still open with the report title
    expect(out).toContain('# Aparture Analysis Report');
    // No paper heading (## 1. ...) should be present
    expect(out).not.toMatch(/^## \d+\./m);
  });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — single paper with full deepAnalysis
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — paper with deepAnalysis', () => {
  it('includes all five deep-analysis sections', () => {
    const paper = makePaper();
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });

    expect(out).toContain('### Relevance Assessment');
    expect(out).toContain('Directly relevant to attention mechanisms.');
    expect(out).toContain('### Key Findings');
    expect(out).toContain('Multi-head attention outperforms RNNs.');
    expect(out).toContain('### Methodology');
    expect(out).toContain('Transformer architecture with self-attention.');
    expect(out).toContain('### Limitations');
    expect(out).toContain('Quadratic complexity with sequence length.');
    expect(out).toContain('### Detailed Technical Summary');
    expect(out).toContain('The paper introduces the Transformer');
  });

  it('uses finalScore when available (not relevanceScore)', () => {
    const paper = makePaper({ finalScore: 9.2, relevanceScore: 7.0 });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('**Score:** 9.2/10');
    expect(out).not.toContain('**Score:** 7.0/10');
  });

  it('includes the arXiv link', () => {
    const paper = makePaper({ id: '2504.12345' });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('[2504.12345](https://arxiv.org/abs/2504.12345)');
  });

  it('formats author list as "et al." when more than two authors', () => {
    const paper = makePaper({ authors: ['Smith, A.', 'Jones, B.', 'Lee, C.'] });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('Smith, A. et al.');
  });

  it('joins two authors with "&"', () => {
    const paper = makePaper({ authors: ['Smith, A.', 'Jones, B.'] });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('Smith, A. & Jones, B.');
  });

  it('shows "Unknown" when authors array is empty', () => {
    const paper = makePaper({ authors: [] });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('**Authors:** Unknown');
  });

  it('shows "Unknown" when authors field is missing', () => {
    const { authors: _a, ...paperNoAuthors } = makePaper();
    const results = { scoredPapers: [paperNoAuthors], finalRanking: [paperNoAuthors] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('**Authors:** Unknown');
  });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — paper WITHOUT deepAnalysis (abstract-only)
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — paper without deepAnalysis', () => {
  it('falls back to scoreJustification for Relevance Assessment', () => {
    const paper = makePaper({ deepAnalysis: undefined });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('Highly relevant to transformer architectures.');
  });

  it('shows "N/A" for Key Findings and Methodology when deepAnalysis is absent', () => {
    const paper = makePaper({ deepAnalysis: undefined });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('### Key Findings\nN/A');
    expect(out).toContain('### Methodology\nN/A');
    expect(out).toContain('### Limitations\nN/A');
  });

  it('shows "No deep analysis available" for Detailed Technical Summary', () => {
    const paper = makePaper({ deepAnalysis: undefined });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('No deep analysis available');
  });

  it('falls back to relevanceScore when finalScore is absent', () => {
    const { finalScore: _f, ...paperNoFinal } = makePaper({ deepAnalysis: undefined });
    const results = { scoredPapers: [paperNoFinal], finalRanking: [paperNoFinal] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('**Score:** 8.5/10');
  });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — multiple papers (ordering / numbering)
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — multiple papers', () => {
  it('renders papers in the order they appear in finalRanking (index-preserving)', () => {
    const p1 = makePaper({ id: '2504.00001', title: 'Alpha Paper', finalScore: 9.0 });
    const p2 = makePaper({ id: '2504.00002', title: 'Beta Paper', finalScore: 7.5 });
    const p3 = makePaper({ id: '2504.00003', title: 'Gamma Paper', finalScore: 8.0 });
    const results = { scoredPapers: [p1, p2, p3], finalRanking: [p1, p2, p3] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });

    const pos1 = out.indexOf('## 1. Alpha Paper');
    const pos2 = out.indexOf('## 2. Beta Paper');
    const pos3 = out.indexOf('## 3. Gamma Paper');

    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(-1);
    expect(pos3).toBeGreaterThan(-1);
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
  });

  it('numbers papers starting at 1', () => {
    const p1 = makePaper({ id: '2504.00001', title: 'First' });
    const p2 = makePaper({ id: '2504.00002', title: 'Second' });
    const results = { scoredPapers: [p1, p2], finalRanking: [p1, p2] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('## 1. First');
    expect(out).toContain('## 2. Second');
  });

  it('separates papers with horizontal-rule dividers', () => {
    const p1 = makePaper({ id: '2504.00001', title: 'First' });
    const p2 = makePaper({ id: '2504.00002', title: 'Second' });
    const results = { scoredPapers: [p1, p2], finalRanking: [p1, p2] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    // There should be the header separator plus one per paper
    const dividerCount = (out.match(/^---$/gm) ?? []).length;
    expect(dividerCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — special characters in title / content
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — special characters', () => {
  it('includes titles with double-quotes verbatim', () => {
    const paper = makePaper({ title: '"Quoted" Title Analysis' });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('"Quoted" Title Analysis');
  });

  it('includes titles with ampersands verbatim', () => {
    const paper = makePaper({ title: 'Cats & Dogs: A Survey' });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('Cats & Dogs: A Survey');
  });

  it('includes titles with hash characters verbatim', () => {
    const paper = makePaper({ title: 'On #Hashtag Phenomena' });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('On #Hashtag Phenomena');
  });

  it('includes titles with LaTeX-style characters verbatim', () => {
    const paper = makePaper({ title: 'Solving $O(n^2)$ Complexity in \\mathbb{R}' });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain('Solving $O(n^2)$ Complexity in \\mathbb{R}');
  });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — long content (no truncation)
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — long content', () => {
  it('does not truncate a very long deepAnalysis summary', () => {
    const longSummary = 'word '.repeat(500).trim(); // 500 words
    const paper = makePaper({
      deepAnalysis: { ...makePaper().deepAnalysis, summary: longSummary },
    });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain(longSummary);
  });

  it('does not truncate a very long title', () => {
    const longTitle = 'A'.repeat(300);
    const paper = makePaper({ title: longTitle });
    const results = { scoredPapers: [paper], finalRanking: [paper] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(out).toContain(longTitle);
  });
});

// ---------------------------------------------------------------------------
// buildReportMarkdown — return type
// ---------------------------------------------------------------------------

describe('buildReportMarkdown — return type', () => {
  it('always returns a string', () => {
    const results = { scoredPapers: [], finalRanking: [] };
    const out = buildReportMarkdown({
      results,
      processingTiming: makeTiming(),
      config: makeConfig(),
    });
    expect(typeof out).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// downloadBlob — minimal smoke test (DOM glue)
// ---------------------------------------------------------------------------

describe('downloadBlob — DOM glue smoke test', () => {
  beforeEach(() => {
    // jsdom doesn't implement URL.createObjectURL — provide a stub
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when called with valid arguments', () => {
    // Stub document.createElement + click so jsdom doesn't error
    const fakeAnchor = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(fakeAnchor);

    expect(() => downloadBlob('hello world', 'test.md', 'text/markdown')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// exportAnalysisReport — placeholder (orchestrates buildReportMarkdown + downloadBlob)
// ---------------------------------------------------------------------------

describe('exportAnalysisReport — orchestrator smoke test', () => {
  it.skip('is covered indirectly by buildReportMarkdown and downloadBlob tests', () => {
    // exportAnalysisReport is a thin glue layer: it calls buildReportMarkdown to get content
    // and downloadBlob to trigger a browser download. Both underlying functions are tested above.
    // A full integration test would require a headless browser environment.
  });
});
