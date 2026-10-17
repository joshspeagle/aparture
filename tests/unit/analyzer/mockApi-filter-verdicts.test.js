// P0-2 regression: every Dry Run wrote ~15 fake filter-override events into
// the user's real feedback memory. The mock filter's `wrong_type` scenario
// returned `verdict: 123` (and `missing_field` returned no verdict) straight
// to the client; the dry-run parser doesn't validate, so those papers landed
// in NO with originalVerdict 123, and the scoring stage then logged
// "filter said 123, user changed to NO" for each one.
//
// The mock stands in for the /api/quick-filter route, which validates the
// verdict enum server-side and never returns anything but YES/MAYBE/NO — so
// the mock must not either.

import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockAPITester, MOCK_FILTER_VERDICTS } from '../../../lib/analyzer/mockApi.js';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

function makeTester(abortControllerRef = { current: null }) {
  const tester = new MockAPITester({
    abortControllerRef,
    pauseRef: { current: false },
    waitForResume: async () => {},
  });
  // No artificial latency in tests; the scenario logic is what's under test.
  tester.sleepWithAbortCheck = async () => {};
  return tester;
}

const papers = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, title: `Paper ${i}` }));

function expectValidVerdicts(text) {
  const verdicts = JSON.parse(text);
  expect(verdicts).toHaveLength(papers.length);
  verdicts.forEach((v, idx) => {
    expect(v.paperIndex).toBe(idx + 1);
    expect(MOCK_FILTER_VERDICTS).toContain(v.verdict);
  });
}

describe('MockAPITester.mockQuickFilter — verdict contract', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns only YES/MAYBE/NO (or a parse failure / thrown error) for every scenario', async () => {
    const tester = makeTester();
    for (const [index, scenario] of tester.scenarios.entries()) {
      // scenario = scenarios[(callCount - 1) % n] after the call's increment.
      tester.callCount = index;
      let text;
      try {
        text = await tester.mockQuickFilter(papers);
      } catch (err) {
        // Only the two transport-failure scenarios throw.
        expect(['retry_failure', 'final_failure']).toContain(scenario);
        expect(err.message).toMatch(/Mock Filter API/);
        continue;
      }
      if (scenario === 'malformed') {
        expect(() => JSON.parse(text)).toThrow();
        tester.callCount = index;
        expectValidVerdicts(await tester.mockQuickFilter(papers, true));
        continue;
      }
      // valid / missing_field / wrong_type all reach the client as valid
      // verdicts — never `123`, never a missing verdict.
      expectValidVerdicts(text);
    }
  });
});

describe('dry run with the quick filter on — no invented overrides (P0-2)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test(
    'every bucketed paper carries a real verdict and no filter-override is recorded',
    { timeout: 60000 },
    async () => {
      const feedback = {
        events: [],
        addFilterOverride: vi.fn(),
        recordFilterOverride: vi.fn(),
      };
      useAnalyzerStore.setState(initialState());
      useAnalyzerStore.setState({
        reactContext: {
          profile: { content: 'test profile content' },
          config: {
            pdfModel: 'claude-haiku-4.5',
            scoringModel: 'claude-haiku-4.5',
            filterModel: 'claude-haiku-4.5',
            briefingModel: 'claude-haiku-4.5',
            selectedCategories: ['cs.AI'],
            useQuickFilter: true,
            // One paper per batch so the run cycles through every mock
            // scenario, including the old `wrong_type` (verdict 123) one.
            filterBatchSize: 1,
            pauseAfterFilter: false,
            pauseBeforeDeepAnalysis: false,
            pauseBeforeBriefing: false,
            enableScorePostProcessing: false,
            maxDeepAnalysis: 5,
            finalOutputCount: 5,
            daysBack: 1,
            batchSize: 10,
            scoringBatchSize: 10,
            maxCorrections: 3,
            maxRetries: 4,
            categoriesToScore: ['YES', 'MAYBE'],
          },
          feedback,
          saveBriefing: vi.fn(),
          briefingHistory: [],
        },
        password: '',
      });

      const abortControllerRef = { current: new AbortController() };
      const pauseRef = { current: false };
      const mockAPITesterRef = { current: makeTester(abortControllerRef) };
      const pipeline = createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef });
      global.fetch = vi.fn(async (url) => {
        throw new Error(`Dry run must not fetch, but called: ${url}`);
      });

      await pipeline.startProcessing(true, true); // isDryRun, useTestPapers

      const { filterResults } = useAnalyzerStore.getState();
      const bucketed = [
        ...filterResults.yes.map((p) => ['YES', p]),
        ...filterResults.maybe.map((p) => ['MAYBE', p]),
        ...filterResults.no.map((p) => ['NO', p]),
      ];
      expect(bucketed).toHaveLength(5);
      for (const [bucket, paper] of bucketed) {
        expect(MOCK_FILTER_VERDICTS).toContain(paper.originalVerdict);
        // Nobody clicked anything, so each paper sits in its own verdict's bucket.
        expect(paper.originalVerdict).toBe(bucket);
      }
      expect(feedback.addFilterOverride).not.toHaveBeenCalled();
      expect(feedback.recordFilterOverride).not.toHaveBeenCalled();
    }
  );
});
