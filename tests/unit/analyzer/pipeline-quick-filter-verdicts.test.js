// Verifies the quick-filter client prefers server-validated verdicts over
// rawResponse (audit P1-3) — the same contract as the score / rescore /
// analyze-pdf stages. The old inverse preference re-parsed rawResponse,
// so a thinking-model prose preamble triggered the frontend correction
// loop (an extra billed LLM call per batch) despite valid verdicts in hand.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

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
        pauseAfterFilter: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 1,
        filterBatchSize: 5,
        scoringBatchSize: 5,
        maxCorrections: 1,
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

describe('pipeline — quick-filter prefers validated verdicts (P1-3)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'validated verdicts win over a non-JSON rawResponse (no correction call fired)',
    { timeout: 30000 },
    async () => {
      setupStore();
      const pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      let filterCalls = 0;
      let correctionCalls = 0;
      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/quick-filter')) {
          filterCalls += 1;
          if (body.correctionPrompt) correctionCalls += 1;
          // Thinking-enabled models can preface the JSON with prose; the
          // route still returns server-validated verdicts alongside.
          return {
            ok: true,
            status: 200,
            json: async () => ({
              verdicts: Array.from({ length: body.papers?.length ?? 1 }, (_, i) => ({
                paperIndex: i + 1,
                verdict: 'YES',
                summary: `Validated summary ${i + 1}.`,
                justification: `Validated justification ${i + 1}.`,
              })),
              rawResponse:
                'Let me think about these papers step by step before answering... (no JSON here)',
            }),
          };
        }
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              rawResponse: JSON.stringify(
                Array.from({ length: body.papers?.length ?? 1 }, (_, i) => ({
                  paperIndex: i + 1,
                  score: 7.5,
                  justification: `Mock scoring justification ${i + 1}.`,
                }))
              ),
            }),
          };
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              analysis: {
                summary: 'Deep analysis with enough characters to pass validation checks.',
                keyFindings: 'Key findings with sufficient length to pass validation.',
                methodology: 'Methodology content with sufficient length to pass validation.',
                limitations: 'Limitations content with sufficient length to pass validation.',
                relevanceAssessment: 'Relevance assessment with sufficient length to pass it.',
                updatedScore: 8.0,
              },
              rawResponse: '{}',
            }),
          };
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf-quick')) {
          return { ok: true, status: 200, json: async () => ({ quickSummary: 'q' }) };
        }
        if (typeof url === 'string' && url.includes('/api/synthesize')) {
          return { ok: false, status: 500, json: async () => ({ error: 'not under test' }) };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true); // 5 TEST_PAPERS, 1 batch

      // Exactly one filter call — the validated verdicts must be used
      // directly, never re-parsed from the prose rawResponse (which would
      // fail and fire a billed correction call).
      expect(correctionCalls).toBe(0);
      expect(filterCalls).toBe(1);

      const { filterResults, processing } = useAnalyzerStore.getState();
      expect(filterResults.yes).toHaveLength(5);
      expect(filterResults.maybe).toHaveLength(0);
      // No "Initial parse failed" / batch-failure errors.
      expect(processing.errors).toEqual([]);
    }
  );
});
