// Retry classification in makeRobustAPICall (audit P2-1, P2-2).
//
// Deterministic 4xx route failures used to be retried like transient ones:
// parseRouteError dropped the status, so a missing key (401), an unknown
// model (400/404) or an oversized request (413) cost maxRetries+1 calls per
// batch plus seconds of backoff each. And Anthropic's 529 (overloaded) was
// NOT treated as a rate limit: it got the plain ladder with no barrier.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';
import { getLLMBarrier, _resetLLMBarriers } from '../../../lib/analyzer/rateLimit.js';

function setupStore(configOverrides = {}) {
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
        useQuickFilter: false,
        pauseAfterFilter: false,
        pauseBeforeDeepAnalysis: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        // One batch for the 5 TEST_PAPERS keeps the call counts exact.
        scoringBatchSize: 5,
        scoringConcurrency: 1,
        maxCorrections: 0,
        maxRetries: 2,
        categoriesToScore: ['YES', 'MAYBE'],
        ...configOverrides,
      },
      feedback: { events: [], addFilterOverride: () => {} },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'x',
  });
  return createAnalysisPipeline({
    abortControllerRef: { current: null },
    pauseRef: { current: false },
    mockAPITesterRef: { current: null },
  });
}

describe('pipeline — retry classification', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    _resetLLMBarriers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    _resetLLMBarriers();
  });

  test('a 401 fails fast: one call, the provider message, no retry backoff', async () => {
    const pipeline = setupStore();
    let scoringCalls = 0;
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/score-abstracts') {
        scoringCalls += 1;
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: 'anthropic request failed (401)',
            details: JSON.stringify({
              type: 'error',
              error: { type: 'authentication_error', message: 'invalid x-api-key' },
            }),
            provider: 'anthropic',
          }),
        };
      }
      throw new Error(`unexpected ${url}`);
    });

    const started = Date.now();
    await pipeline.startProcessing(false, true);
    const { processing } = useAnalyzerStore.getState();

    // maxRetries is 2: a retried 401 would make 3 calls with ~3 s of backoff.
    expect(scoringCalls).toBe(1);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(processing.statusLog.join('\n')).not.toMatch(/retrying/);
    expect(processing.errors.some((e) => /invalid x-api-key/.test(e))).toBe(true);
    expect(processing.errors.some((e) => /after all retries/.test(e))).toBe(false);
  });

  test('a 529 (overloaded) is retried as a rate limit and pauses the provider barrier', async () => {
    const pipeline = setupStore({ maxRetries: 1 });
    const barrier = getLLMBarrier('anthropic');
    const rateLimitedSpy = vi.spyOn(barrier, 'rateLimited');
    let scoringCalls = 0;
    global.fetch = vi.fn(async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : {};
      if (url === '/api/score-abstracts') {
        scoringCalls += 1;
        if (scoringCalls === 1) {
          return {
            ok: false,
            status: 529,
            // Retry-After 0 keeps the test fast while still exercising the
            // rate-limit branch (barrier signal + Retry-After honored).
            json: async () => ({ error: 'Overloaded', provider: 'anthropic', retryAfterMs: 0 }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            scores: body.papers.map((_, i) => ({
              paperIndex: i + 1,
              score: 0,
              justification: 'not relevant',
            })),
          }),
        };
      }
      throw new Error(`unexpected ${url}`);
    });

    await pipeline.startProcessing(false, true);

    expect(scoringCalls).toBe(2);
    expect(rateLimitedSpy).toHaveBeenCalledWith({ retryAfterMs: 0 });
    const log = useAnalyzerStore.getState().processing.statusLog.join('\n');
    expect(log).toMatch(/anthropic: overloaded \(529\)/);
  });
});
