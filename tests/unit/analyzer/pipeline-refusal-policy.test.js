// End-to-end behavior of config.refusalPolicy when /api/analyze-pdf returns
// HTTP 422 + CONTENT_REFUSAL (a safety classifier declining).
//
// Modeled on pipeline-playwright-skip.test.js — the refusal path deliberately
// reuses that stage's skip machinery, so the two should behave alike.
//
// Three properties matter, one per policy:
//   'skip'     — record it, mark the paper, keep the run alive
//   'fallback' — re-issue once against refusalFallbackModel
//   'fail'     — propagate rather than silently dropping the paper
// Plus the cross-cutting one: a refusal never enters the retry ladder.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

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

function buildRefusalResponse() {
  return {
    ok: false,
    status: 422,
    json: async () => ({
      code: 'CONTENT_REFUSAL',
      error: 'anthropic declined this request (cyber)',
      provider: 'anthropic',
      model: 'claude-opus-5',
      category: 'cyber',
      raw: 'cyber',
    }),
  };
}

function buildSuccessPDFResponse(title) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      analysis: {
        summary: `Deep analysis summary for ${title} with enough characters.`,
        keyFindings: 'Key findings with sufficient length to pass validation.',
        methodology: 'Methodology content with sufficient length to pass validation.',
        limitations: 'Limitations content with sufficient length to pass validation.',
        relevanceAssessment: 'Relevance assessment with sufficient length to pass validation.',
        updatedScore: 8.0,
      },
      rawResponse: JSON.stringify({ summary: `Deep analysis for ${title}.`, updatedScore: 8.0 }),
    }),
  };
}

function setupStore(configOverrides = {}) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    reactContext: {
      profile: { content: 'test profile content' },
      config: {
        pdfModel: 'claude-opus-5',
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
        // Deliberately non-zero: a refusal must short-circuit this ladder
        // rather than burning all 3 retries on a deterministic decline.
        maxRetries: 3,
        categoriesToScore: ['YES', 'MAYBE'],
        ...configOverrides,
      },
      feedback: { events: [] },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });

  return createAnalysisPipeline({
    abortControllerRef: { current: new AbortController() },
    pauseRef: { current: false },
    mockAPITesterRef: { current: null },
  });
}

describe('pipeline — safety-refusal policy', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'skip policy: records the refusal, marks the paper, keeps running',
    { timeout: 30000 },
    async () => {
      const pipeline = setupStore({ refusalPolicy: 'skip' });
      let pdfCallCount = 0;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse((body.papers ?? []).length);
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
          pdfCallCount += 1;
          if (pdfCallCount === 1) return buildRefusalResponse();
          return buildSuccessPDFResponse(`Paper ${pdfCallCount}`);
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      useAnalyzerStore.getState().addRefusal({ stage: 'pdf', scope: 'leftover from prior run' });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      // Prior-run entries are cleared at run start.
      expect(state.refusals.some((r) => r.scope === 'leftover from prior run')).toBe(false);

      const recorded = state.refusals.filter((r) => r.stage === 'pdf');
      expect(recorded.length).toBe(1);
      expect(recorded[0].provider).toBe('anthropic');
      expect(recorded[0].category).toBe('cyber');

      // The paper stays in results, flagged, rather than vanishing.
      expect(
        state.results.finalRanking.some((p) => p.pdfAnalysisSkipReason === 'content-refusal')
      ).toBe(true);

      // And the rest of the run completed — the other papers were analysed.
      expect(state.results.finalRanking.some((p) => p.deepAnalysis)).toBe(true);
    }
  );

  test('a refusal does not consume the retry ladder', { timeout: 30000 }, async () => {
    // maxRetries is 3 above. If refusals were treated as ordinary failures,
    // the first paper alone would generate 4 PDF calls. Short-circuiting
    // means exactly one call per paper.
    const pipeline = setupStore({ refusalPolicy: 'skip' });
    let pdfCallCount = 0;

    global.fetch = vi.fn(async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : {};
      if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
        return buildScoredBatchResponse((body.papers ?? []).length);
      }
      if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
        pdfCallCount += 1;
        return buildRefusalResponse();
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await pipeline.startProcessing(false, true);
    const state = useAnalyzerStore.getState();

    const refusedPapers = state.refusals.filter((r) => r.stage === 'pdf').length;
    expect(refusedPapers).toBeGreaterThan(0);
    // One call per refused paper — no retry amplification.
    expect(pdfCallCount).toBe(refusedPapers);
  });

  test(
    'fallback policy: re-issues once against refusalFallbackModel',
    { timeout: 30000 },
    async () => {
      const pipeline = setupStore({
        refusalPolicy: 'fallback',
        refusalFallbackModel: 'claude-haiku-4.5',
      });
      const modelsTried = [];

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse((body.papers ?? []).length);
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
          modelsTried.push(body.model);
          // The primary model always refuses; the fallback always succeeds.
          if (body.model === 'claude-opus-5') return buildRefusalResponse();
          return buildSuccessPDFResponse('fallback-analysed paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      // The fallback model was actually reached...
      expect(modelsTried).toContain('claude-haiku-4.5');
      // ...and produced a real analysis, so nothing was skipped.
      expect(state.results.finalRanking.some((p) => p.deepAnalysis)).toBe(true);
      expect(
        state.results.finalRanking.some((p) => p.pdfAnalysisSkipReason === 'content-refusal')
      ).toBe(false);
    }
  );

  test('fail policy: halts the run at the refused paper', { timeout: 30000 }, async () => {
    const pipeline = setupStore({ refusalPolicy: 'fail', pdfAnalysisConcurrency: 1 });
    const urls = [];

    global.fetch = vi.fn(async (url, options) => {
      urls.push(url);
      const body = options?.body ? JSON.parse(options.body) : {};
      if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
        return buildScoredBatchResponse((body.papers ?? []).length);
      }
      if (typeof url === 'string' && url === '/api/analyze-pdf') {
        return buildRefusalResponse();
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await pipeline.startProcessing(false, true);
    const state = useAnalyzerStore.getState();

    // The run HALTED: the pool stopped dispatching after the first refused
    // paper (concurrency 1), and nothing downstream ran — no quick
    // summaries, no synthesis. (Before the fix the pool swallowed the error,
    // every paper was attempted, and the run went on to the briefing stage.)
    expect(urls.filter((u) => u === '/api/analyze-pdf')).toHaveLength(1);
    expect(urls.some((u) => u === '/api/analyze-pdf-quick' || u === '/api/synthesize')).toBe(false);
    // The refusal is recorded for the RefusalSummaryCard…
    const recorded = state.refusals.filter((r) => r.stage === 'pdf');
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ provider: 'anthropic', category: 'cyber' });
    // …and the run error says what happened and which policy did it, instead
    // of the generic "Failed to analyze paper … after all retries".
    expect(state.processing.errors).toHaveLength(1);
    expect(state.processing.errors[0]).toMatch(/Run halted: anthropic declined PDF analysis/);
    expect(state.processing.errors[0]).toMatch(/refusalPolicy is 'fail'/);
    // Under 'fail' the paper must NOT be quietly marked as a skip.
    expect(
      state.results.finalRanking.some((p) => p.pdfAnalysisSkipReason === 'content-refusal')
    ).toBe(false);
    expect(state.processing.isRunning).toBe(false);
  });

  test(
    'fail policy in the filter stage halts instead of silently dropping the batch',
    { timeout: 30000 },
    async () => {
      // The auditor's probe: batch 1 refused under 'fail' made its 2 papers
      // vanish from every bucket with processing.errors EMPTY, and the run
      // still saved a briefing.
      const pipeline = setupStore({
        refusalPolicy: 'fail',
        useQuickFilter: true,
        filterBatchSize: 2,
        filterConcurrency: 1,
      });
      const urls = [];
      let filterCall = 0;
      global.fetch = vi.fn(async (url, options) => {
        urls.push(url);
        const body = options?.body ? JSON.parse(options.body) : {};
        if (url === '/api/quick-filter') {
          filterCall += 1;
          if (filterCall === 1) return buildRefusalResponse();
          return {
            ok: true,
            status: 200,
            json: async () => ({
              verdicts: body.papers.map((_, i) => ({
                paperIndex: i + 1,
                verdict: 'YES',
                summary: 's',
                justification: 'j',
              })),
            }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      expect(filterCall).toBe(1);
      expect(urls.some((u) => u !== '/api/quick-filter')).toBe(false);
      expect(state.refusals).toEqual([
        expect.objectContaining({ stage: 'filter', scope: 'batch 1 (2 papers)' }),
      ]);
      expect(state.processing.errors).toHaveLength(1);
      expect(state.processing.errors[0]).toMatch(/Run halted: anthropic declined filter/);
    }
  );

  test(
    'fail policy in the scoring stage halts before PDF analysis',
    { timeout: 30000 },
    async () => {
      const pipeline = setupStore({
        refusalPolicy: 'fail',
        scoringBatchSize: 2,
        scoringConcurrency: 1,
      });
      const urls = [];
      global.fetch = vi.fn(async (url) => {
        urls.push(url);
        if (url === '/api/score-abstracts') return buildRefusalResponse();
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      expect(urls.filter((u) => u === '/api/score-abstracts')).toHaveLength(1);
      expect(urls.some((u) => u === '/api/analyze-pdf')).toBe(false);
      expect(state.refusals.map((r) => r.stage)).toEqual(['scoring']);
      expect(state.processing.errors).toHaveLength(1);
      expect(state.processing.errors[0]).toMatch(/Run halted: anthropic declined scoring/);
      // Not the misleading "Check your API configuration" message.
      expect(state.processing.errors[0]).not.toMatch(/API configuration/);
    }
  );

  test(
    'skip policy in the filter stage records the refusal and keeps the batch as MAYBE',
    { timeout: 30000 },
    async () => {
      const pipeline = setupStore({
        refusalPolicy: 'skip',
        useQuickFilter: true,
        filterBatchSize: 2,
        filterConcurrency: 1,
      });
      let filterCall = 0;
      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (url === '/api/quick-filter') {
          filterCall += 1;
          if (filterCall === 1) return buildRefusalResponse();
          return {
            ok: true,
            status: 200,
            json: async () => ({
              verdicts: body.papers.map((_, i) => ({
                paperIndex: i + 1,
                verdict: 'NO',
                summary: 's',
                justification: 'j',
              })),
            }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      // All 3 batches were attempted (skip keeps the run alive)…
      expect(filterCall).toBe(3);
      // …the refusal is recorded…
      expect(state.refusals).toEqual([expect.objectContaining({ stage: 'filter' })]);
      // …and the refused batch's 2 papers survive as MAYBE rather than vanishing.
      expect(state.filterResults.maybe).toHaveLength(2);
      expect(state.filterResults.no).toHaveLength(3);
    }
  );

  test(
    'cross-provider fallback single-flights the first Anthropic call',
    { timeout: 30000 },
    async () => {
      // The stage's worker pool derives cacheWarmup from the slot model
      // (Google here), so it never warms Anthropic. Without the gate, N
      // parallel fallbacks would each pay a cache-create instead of one
      // create + N-1 reads.
      const pipeline = setupStore({
        pdfModel: 'gemini-3.6-flash',
        refusalPolicy: 'fallback',
        refusalFallbackModel: 'claude-opus-5',
        pdfAnalysisConcurrency: 5,
        maxDeepAnalysis: 5,
      });

      let anthropicInFlight = 0;
      let peakAnthropicInFlight = 0;
      let firstAnthropicSettled = false;
      let overlappedBeforeWarm = false;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse((body.papers ?? []).length);
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
          if (body.model === 'gemini-3.6-flash') return buildRefusalResponse();

          anthropicInFlight += 1;
          peakAnthropicInFlight = Math.max(peakAnthropicInFlight, anthropicInFlight);
          if (!firstAnthropicSettled && anthropicInFlight > 1) overlappedBeforeWarm = true;
          // Yield so genuinely-parallel calls would overlap here.
          await new Promise((r) => setTimeout(r, 5));
          anthropicInFlight -= 1;
          firstAnthropicSettled = true;
          return buildSuccessPDFResponse('fallback-analysed paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      // The load-bearing assertion: nothing overlapped the warming call.
      expect(overlappedBeforeWarm).toBe(false);
      // But the gate opened afterwards — this isn't just serialising everything.
      expect(peakAnthropicInFlight).toBeGreaterThan(1);
      // And the fallbacks actually produced analyses.
      expect(state.results.finalRanking.some((p) => p.deepAnalysis)).toBe(true);
    }
  );
});
