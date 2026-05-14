// Verifies the reentry guard in startProcessing: a second call while a
// run is already in flight must be a no-op. Without this guard, both
// runs would race-push to filterResults buckets and every paper would
// be sent through the LLM twice — the bug observed when the Sidebar
// "+ New Briefing" button was clicked during an active run.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

function buildFilterBatchResponse(numPapers) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          verdict: 'MAYBE',
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

function setupStore() {
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
        pauseAfterFilter: false,
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
      },
      feedback: { events: [] },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });
}

describe('pipeline — reentry guard on startProcessing', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('second startProcessing call during active run is a no-op', { timeout: 30000 }, async () => {
    setupStore();
    const pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });

    // Slow-down filter calls so the first startProcessing is reliably
    // mid-filter when we fire the second call.
    let filterCalls = 0;
    global.fetch = vi.fn(async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : {};
      if (typeof url === 'string' && url.includes('/api/quick-filter')) {
        filterCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return buildFilterBatchResponse(body.papers?.length ?? 1);
      }
      if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
        return buildScoredBatchResponse(body.papers?.length ?? 1);
      }
      if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
        return buildPDFResponse(8.0, body.title ?? 'paper');
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    // Kick off the first run (don't await — keep it in flight).
    const firstRun = pipeline.startProcessing(false, true);

    // Yield once so the first call's synchronous setProcessing({isRunning:true})
    // has applied before the second call's guard read.
    await Promise.resolve();
    expect(useAnalyzerStore.getState().processing.isRunning).toBe(true);

    // Second invocation must observe isRunning=true and bail.
    const secondRun = pipeline.startProcessing(false, true);
    await secondRun;
    // First run still in flight when secondRun returned — the guard didn't wait.
    expect(useAnalyzerStore.getState().processing.isRunning).toBe(true);

    // Let the first run drain.
    await firstRun;

    // TEST_PAPERS = 5 papers × filterBatchSize=1 = 5 filter LLM calls.
    // Without the guard we'd see 10 (two concurrent runs).
    expect(filterCalls).toBe(5);

    // Buckets must hold exactly one entry per paper — no duplicates.
    const { filterResults } = useAnalyzerStore.getState();
    const totalBucketEntries =
      filterResults.yes.length + filterResults.maybe.length + filterResults.no.length;
    expect(totalBucketEntries).toBe(5);
  });
});
