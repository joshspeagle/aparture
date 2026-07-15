// Verifies the pauseAfterFilter gate-resume path rebuilds papersToScore
// from config.categoriesToScore (audit P1-1). The pre-gate path has always
// honored the setting; the gate rebuild used to hardcode YES-always/NO-never,
// silently dropping NO-selected papers and ignoring MAYBE-only selections.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

function buildFilterBatchResponse(numPapers, verdict) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          verdict,
          summary: `Mock filter summary ${i + 1}.`,
          justification: `Mock justification ${i + 1}.`,
        }))
      ),
    }),
  };
}

function buildScoredBatchResponse(numPapers) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          score: 7.5,
          justification: `Mock scoring justification ${i + 1}.`,
        }))
      ),
    }),
  };
}

function buildPDFResponse(updatedScore, paperTitle) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      analysis: {
        summary: `Deep analysis for ${paperTitle} with enough characters to pass validation.`,
        keyFindings: 'Key findings with sufficient length to pass validation.',
        methodology: 'Methodology content with sufficient length to pass validation.',
        limitations: 'Limitations content with sufficient length to pass validation.',
        relevanceAssessment: 'Relevance assessment with sufficient length to pass validation.',
        updatedScore,
      },
      rawResponse: JSON.stringify({ summary: `Deep analysis for ${paperTitle}.`, updatedScore }),
    }),
  };
}

function setupStore(configOverrides = {}) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    reactContext: {
      profile: { content: 'test profile content' },
      config: {
        pdfModel: 'gemini-3.1-pro',
        scoringModel: 'gemini-3.1-pro',
        filterModel: 'gemini-3.1-pro',
        briefingModel: 'gemini-3.1-pro',
        selectedCategories: ['cs.AI'],
        useQuickFilter: true,
        pauseAfterFilter: true,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 1,
        filterBatchSize: 1,
        scoringBatchSize: 1,
        maxCorrections: 0,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        filterConcurrency: 1,
        scoringConcurrency: 1,
        pdfAnalysisConcurrency: 1,
        ...configOverrides,
      },
      feedback: { events: [], addFilterOverride: () => {} },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });
}

// Poll the store until the run parks at the filter-review gate, then
// release the pause — standing in for the user's "Continue to scoring →".
async function resumeWhenGateReached(pauseRef, { timeoutMs = 10000 } = {}) {
  const t0 = Date.now();
  while (useAnalyzerStore.getState().processing.stage !== 'filter-review') {
    if (Date.now() - t0 > timeoutMs) throw new Error('filter-review gate never reached');
    await new Promise((r) => setTimeout(r, 10));
  }
  pauseRef.current = false;
}

describe('pipeline — filter gate honors categoriesToScore (P1-1)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'NO-selected papers survive the gate resume when categoriesToScore includes NO',
    { timeout: 30000 },
    async () => {
      setupStore({ categoriesToScore: ['YES', 'MAYBE', 'NO'] });
      const pauseRef = { current: false };
      const pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef,
        mockAPITesterRef: { current: null },
      });

      let papersSentToScoring = 0;
      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/quick-filter')) {
          // Every paper filters as NO.
          return buildFilterBatchResponse(body.papers?.length ?? 1, 'NO');
        }
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          papersSentToScoring += body.papers?.length ?? 0;
          return buildScoredBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf-quick')) {
          return { ok: true, status: 200, json: async () => ({ quickSummary: 'q' }) };
        }
        if (typeof url === 'string' && url.includes('/api/synthesize')) {
          return { ok: false, status: 500, json: async () => ({ error: 'not under test' }) };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const run = pipeline.startProcessing(false, true); // 5 TEST_PAPERS
      await resumeWhenGateReached(pauseRef);
      await run;

      // All 5 NO papers must be rebuilt into papersToScore at the gate.
      // The old gate logic (yes ∪ maybe-if-selected) dropped them all.
      expect(papersSentToScoring).toBe(5);
      const { filterResults } = useAnalyzerStore.getState();
      expect(filterResults.no).toHaveLength(5);
    }
  );

  test(
    'YES papers are excluded at the gate resume when categoriesToScore is MAYBE-only',
    { timeout: 30000 },
    async () => {
      setupStore({ categoriesToScore: ['MAYBE'] });
      const pauseRef = { current: false };
      const pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef,
        mockAPITesterRef: { current: null },
      });

      // First 2 batches filter YES, remaining 3 filter MAYBE.
      let filterCall = 0;
      let papersSentToScoring = 0;
      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/quick-filter')) {
          filterCall += 1;
          const verdict = filterCall <= 2 ? 'YES' : 'MAYBE';
          return buildFilterBatchResponse(body.papers?.length ?? 1, verdict);
        }
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          papersSentToScoring += body.papers?.length ?? 0;
          return buildScoredBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf-quick')) {
          return { ok: true, status: 200, json: async () => ({ quickSummary: 'q' }) };
        }
        if (typeof url === 'string' && url.includes('/api/synthesize')) {
          return { ok: false, status: 500, json: async () => ({ error: 'not under test' }) };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const run = pipeline.startProcessing(false, true);
      await resumeWhenGateReached(pauseRef);
      await run;

      // Only the 3 MAYBE papers may proceed. The old gate logic
      // unconditionally included the YES bucket (5 papers total).
      expect(papersSentToScoring).toBe(3);
    }
  );
});
