// Verifies the dry run stays fully offline through the briefing stage.
//
// Before this test's fix, `startProcessing(isDryRun = true)` mocked
// filter/score/rescore/PDF but let the auto-briefing stage hit the real
// /api/analyze-pdf-quick, /api/synthesize, and /api/check-briefing routes —
// which 401'd on a keyless install ("Warning: N/N quick summaries failed")
// and made real billed LLM calls on a configured one. The pipeline must hand
// the MockAPITester to runBriefingGeneration so the whole briefing stage is
// mocked and the saved briefing flows through the normal saveBriefing path.
//
// Runs with useTestPapers = true so Stage 1 (the genuinely-network arXiv
// fetch a real dry run performs) is excluded; every stage after that must
// make zero fetch calls.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { MockAPITester } from '../../../lib/analyzer/mockApi.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';
import { validateBriefing } from '../../../lib/synthesis/validator.js';

describe('pipeline — dry-run briefing is fully mocked', () => {
  let originalFetch;
  let pipeline;
  let saveBriefing;

  beforeEach(() => {
    useAnalyzerStore.setState(initialState());
    saveBriefing = vi.fn();

    useAnalyzerStore.setState({
      reactContext: {
        profile: { content: 'test profile content' },
        config: {
          pdfModel: 'claude-haiku-4.5',
          scoringModel: 'claude-haiku-4.5',
          filterModel: 'claude-haiku-4.5',
          briefingModel: 'claude-haiku-4.5',
          selectedCategories: ['cs.AI'],
          // Skip the filter (its mock verdicts are random) and all gates so
          // the run drives itself end-to-end without a UI.
          useQuickFilter: false,
          pauseAfterFilter: false,
          pauseBeforeDeepAnalysis: false,
          pauseBeforeBriefing: false,
          enableScorePostProcessing: false,
          maxDeepAnalysis: 5,
          finalOutputCount: 5,
          daysBack: 1,
          batchSize: 10,
          scoringBatchSize: 10,
          // Generous budgets so the mock's cycling failure scenarios
          // (malformed / missing_field / retry_failure / ...) all recover.
          maxCorrections: 3,
          maxRetries: 4,
          categoriesToScore: ['YES', 'MAYBE'],
        },
        feedback: { events: [] },
        saveBriefing,
        briefingHistory: [],
      },
      password: '',
    });

    const abortControllerRef = { current: new AbortController() };
    const pauseRef = { current: false };
    const mockAPITesterRef = {
      current: new MockAPITester({
        abortControllerRef,
        pauseRef,
        waitForResume: async () => {},
      }),
    };
    pipeline = createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef });

    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test(
    'dry run saves a schema-valid mocked briefing with zero fetch calls',
    { timeout: 60000 },
    async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      global.fetch = vi.fn(async (url) => {
        throw new Error(`Dry run must not fetch, but called: ${url}`);
      });

      await pipeline.startProcessing(true, true); // isDryRun, useTestPapers

      const state = useAnalyzerStore.getState();
      expect(state.processing.errors).toEqual([]);

      // The entire run — filter through briefing — touched no route.
      expect(global.fetch).not.toHaveBeenCalled();

      // A briefing was saved through the normal path and passes the real
      // schema + citation validator: every cited arxivId comes from the run.
      expect(saveBriefing).toHaveBeenCalledTimes(1);
      const [, briefing, metadata, extras] = saveBriefing.mock.calls[0];
      const inputIds = state.results.finalRanking.map((p) => p.arxivId ?? p.id);
      expect(validateBriefing(briefing, inputIds)).toEqual({ ok: true, errors: [] });

      // Quick summaries populated for the papers that produced full reports.
      expect(Object.keys(extras.quickSummariesById).length).toBeGreaterThan(0);
      expect(metadata.hallucinationCheck).toMatchObject({ verdict: 'NO' });

      // Dry-run briefings stay identifiable as mock data after the run ends
      // (the TEST MODE chip in BriefingHeader keys off this).
      expect(metadata.testMode).toBe(true);

      // No swallowed briefing failure.
      expect(state.briefingUI.synthesisError).toBeNull();
    }
  );
});
