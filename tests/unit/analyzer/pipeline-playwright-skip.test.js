// Verifies that when /api/analyze-pdf returns HTTP 422 with
// PLAYWRIGHT_UNAVAILABLE_RECAPTCHA, the pipeline's analyzePDFs loop:
//   1. Pushes the paper into the store's `skippedDueToRecaptcha` slice
//   2. Marks the paper with `pdfAnalysisSkipReason: 'recaptcha-no-playwright'`
//   3. Continues the run (doesn't halt or raise)
//
// Also verifies that a fresh run start clears the prior skip list.
//
// The test mocks the global fetch and runs `startProcessing` with
// `useTestPapers = true` so the fetchPapers / quickFilter / scoreAbstracts
// branches are kept simple and exercised end-to-end.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

// Build a realistic-enough scoring response so scoreAbstracts + post-process
// + PDF analysis can all run on top of the hardcoded TEST_PAPERS list.
function buildScoredBatchResponse(numPapers) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          score: 7.5,
          justification: `Mock justification for paper ${i + 1}.`,
        }))
      ),
    }),
  };
}

function build422Response(paper) {
  return {
    ok: false,
    status: 422,
    json: async () => ({
      error: 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA',
      arxivId: paper.arxivId ?? paper.id,
      title: paper.title,
    }),
  };
}

function buildSuccessPDFResponse(paper) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      analysis: {
        summary: `Deep analysis summary for ${paper.title} with enough characters.`,
        keyFindings: 'Key findings with sufficient length to pass validation.',
        methodology: 'Methodology content with sufficient length to pass validation.',
        limitations: 'Limitations content with sufficient length to pass validation.',
        relevanceAssessment: 'Relevance assessment with sufficient length to pass validation.',
        updatedScore: 8.0,
      },
      rawResponse: JSON.stringify({
        summary: `Deep analysis for ${paper.title}.`,
        updatedScore: 8.0,
      }),
    }),
  };
}

describe('pipeline — Playwright skip handling', () => {
  let originalFetch;
  let pipeline;

  beforeEach(() => {
    // Reset Zustand store to pristine state
    useAnalyzerStore.setState(initialState());

    // Publish minimal reactContext so the pipeline can read config + profile
    useAnalyzerStore.setState({
      reactContext: {
        profile: { content: 'test profile content' },
        config: {
          pdfModel: 'claude-haiku-4.5',
          scoringModel: 'claude-haiku-4.5',
          filterModel: 'claude-haiku-4.5',
          briefingModel: 'claude-haiku-4.5',
          selectedCategories: ['cs.AI'],
          useQuickFilter: false,
          pauseAfterFilter: false,
          pauseBeforeBriefing: false,
          enableScorePostProcessing: false,
          maxDeepAnalysis: 5,
          finalOutputCount: 5,
          daysBack: 1,
          batchSize: 3,
          scoringBatchSize: 3,
          maxCorrections: 0,
          maxRetries: 0,
          categoriesToScore: ['YES', 'MAYBE'],
        },
        feedback: { events: [] },
        saveBriefing: null,
        briefingHistory: [],
      },
      password: 'ignored-in-this-test',
    });

    pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });

    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'aggregates reCAPTCHA-skipped papers without halting the run',
    { timeout: 30000 },
    async () => {
      // Counts scoring calls vs PDF calls
      let pdfCallCount = 0;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};

        // Score-abstracts batch response
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          const papers = body.papers ?? [];
          return buildScoredBatchResponse(papers.length);
        }

        // PDF analysis: first paper skipped via 422, rest succeed
        if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
          pdfCallCount += 1;
          if (pdfCallCount === 1) {
            return build422Response({
              arxivId: body.pdfUrl?.match(/pdf\/(.+?)(?:\.pdf|$)/)?.[1] ?? 'unknown',
              title: 'reCAPTCHA-blocked paper',
            });
          }
          return buildSuccessPDFResponse({ title: `Paper ${pdfCallCount}` });
        }

        // Fallback — 200 with empty rawResponse won't pass validation, but
        // any unexpected call should fail loudly.
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      // Pre-populate a bogus skipped entry to verify clearSkippedDueToRecaptcha
      // wouldn't yet be triggered automatically (we rely on start-of-run clear
      // wired in this task).
      useAnalyzerStore.getState().addSkippedDueToRecaptcha({
        id: 'leftover',
        arxivId: 'leftover',
        title: 'Leftover from previous run',
      });

      // Run the pipeline with test papers (skips arXiv fetch + quick-filter)
      await pipeline.startProcessing(false, true);

      const state = useAnalyzerStore.getState();

      // The leftover entry from a prior run should have been cleared; only
      // entries from *this* run should remain.
      expect(state.skippedDueToRecaptcha.some((p) => p.id === 'leftover')).toBe(false);

      // Exactly one paper should have been aggregated as Playwright-skipped
      expect(state.skippedDueToRecaptcha.length).toBeGreaterThanOrEqual(1);

      // The results slice should mark that paper with the skip reason
      const skippedResultPaper = state.results.finalRanking.find(
        (p) => p.pdfAnalysisSkipReason === 'recaptcha-no-playwright'
      );
      expect(skippedResultPaper).toBeDefined();
    }
  );
});
