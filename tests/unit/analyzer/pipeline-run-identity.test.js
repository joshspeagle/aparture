// @vitest-environment jsdom
//
// Run identity + abort threading (audit P1-1). Stop used to not stop: every
// stage re-read abortControllerRef.current, the OAI page fetch carried no
// signal, and the run's `finally` reset state for whichever run happened to
// be current. Reproduced by the auditor: Stop → Start while run A waited on a
// slow OAI page produced TWO billed pipelines and TWO saved briefings, and a
// Stop alone wiped the previous run's results and raised "No papers could be
// scored successfully. Check your API configuration".
//
// jsdom environment: Stage 1 runs the real harvest → harvestOai path, which
// parses the OAI XML with the global DOMParser.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// v1 two days ago, so the submitted-only anchor lands inside the OAI window.
const V1_DATE = new Date(Date.now() - 2 * 86400000).toUTCString();
const oaiXml = (ids) =>
  `<?xml version="1.0"?><OAI-PMH><ListRecords>${ids
    .map(
      (id) =>
        `<record><metadata><arXivRaw><id>${id}</id><title>T ${id}</title><abstract>A ${id}</abstract><authors>X</authors><categories>cs.AI</categories><version version="v1"><date>${V1_DATE}</date></version></arXivRaw></metadata></record>`
    )
    .join('')}</ListRecords></OAI-PMH>`;

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

// Resolves after `ms`, or rejects like real fetch when its signal fires.
function cancellable(opts, makeResponse, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(makeResponse()), ms);
    opts?.signal?.addEventListener?.(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('This operation was aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

const BRIEFING = {
  executiveSummary: 'e',
  themes: [{ title: 't', argument: 'a', paperIds: ['2610.00001'] }],
  papers: [{ arxivId: '2610.00001', title: 'T', score: 7, onelinePitch: 'p', whyMatters: 'w' }],
};

function setupStore(configOverrides = {}, saveBriefing = vi.fn(async () => 'id')) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    reactContext: {
      profile: { content: 'p' },
      config: {
        pdfModel: 'claude-haiku-4.5',
        scoringModel: 'claude-haiku-4.5',
        filterModel: 'claude-haiku-4.5',
        briefingModel: 'claude-haiku-4.5',
        quickSummaryModel: 'claude-haiku-4.5',
        selectedCategories: ['cs.AI'],
        useQuickFilter: false,
        pauseAfterFilter: false,
        pauseBeforeDeepAnalysis: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 2,
        finalOutputCount: 2,
        daysBack: 1,
        scoringBatchSize: 5,
        maxCorrections: 0,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        arxivIngestion: 'oai-only',
        arxivCacheTtlMinutes: 0,
        minPapersPerSubcategory: 0,
        lookbackExtensions: [],
        ...configOverrides,
      },
      feedback: { events: [], addFilterOverride: () => {} },
      saveBriefing,
      briefingHistory: [],
      seenPapersIndex: {},
      seenPapersReady: true,
    },
    password: 'x',
  });
  return saveBriefing;
}

// What App.jsx's handleStop does.
function pressStop(abortControllerRef, pauseRef) {
  abortControllerRef.current?.abort();
  pauseRef.current = false;
  useAnalyzerStore
    .getState()
    .setProcessing((p) => ({ ...p, isRunning: false, isPaused: false, stage: 'idle' }));
}

// Route-level mock: counts calls per route and lets each test shape the
// harvest and scoring responses.
function installFetch({ harvest, score }) {
  const calls = {};
  global.fetch = vi.fn(async (url, opts) => {
    calls[url] = (calls[url] ?? 0) + 1;
    const body = opts?.body ? JSON.parse(opts.body) : {};
    if (url === '/api/harvest-arxiv') return harvest(opts, calls[url]);
    if (url === '/api/score-abstracts') {
      const respond = () =>
        ok({
          scores: body.papers.map((_, i) => ({
            paperIndex: i + 1,
            score: 7,
            justification: 'justification text',
          })),
        });
      return score ? score(opts, respond, calls[url]) : respond();
    }
    if (url === '/api/analyze-pdf') {
      return ok({
        analysis: {
          summary: 'summary text long enough',
          keyFindings: 'k',
          methodology: 'm',
          limitations: 'l',
          relevanceAssessment: 'r',
          updatedScore: 8,
        },
      });
    }
    if (url === '/api/analyze-pdf-quick') return ok({ quickSummary: 'q' });
    if (url === '/api/synthesize') return ok({ briefing: BRIEFING });
    if (url === '/api/check-briefing')
      return ok({ verdict: 'NO', justification: 'ok', flaggedClaims: [] });
    throw new Error(`unexpected fetch ${url}`);
  });
  return calls;
}

describe('pipeline — run identity and Stop', () => {
  let originalFetch;
  let abortControllerRef;
  let pauseRef;

  beforeEach(() => {
    originalFetch = global.fetch;
    abortControllerRef = { current: null };
    pauseRef = { current: false };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const makePipeline = () =>
    createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef: { current: null } });

  test(
    'Stop → Start while run A waits on an uncancellable OAI page bills ONE pipeline and saves ONE briefing',
    { timeout: 20000 },
    async () => {
      const saveBriefing = setupStore();
      let observedMidRunB = null;
      const calls = installFetch({
        // Run A's page ignores its signal (the auditor's probe) and returns
        // ~300 ms later, i.e. while run B is mid-scoring.
        harvest: async (opts, n) => {
          if (n === 1) await sleep(300);
          return ok({ xml: oaiXml(['2610.00001', '2610.00002']), resumptionToken: '' });
        },
        // Hold run B's scoring open past A's page returning, then observe.
        score: async (opts, respond) => {
          await sleep(600);
          observedMidRunB = useAnalyzerStore.getState().processing.isRunning;
          return respond();
        },
      });
      const pipeline = makePipeline();

      const runA = pipeline.startProcessing(false, false);
      await sleep(50);
      pressStop(abortControllerRef, pauseRef);
      const runB = pipeline.startProcessing(false, false);
      const [outcomeA, outcomeB] = await Promise.all([runA, runB]);

      expect(outcomeA).toBe('superseded');
      expect(outcomeB).toBe('finished');
      // A's late page never reached scoring: one scoring call (B's), one deep
      // analysis per selected paper (B's 2), one synthesis, one saved briefing.
      expect(calls['/api/harvest-arxiv']).toBe(2);
      expect(calls['/api/score-abstracts']).toBe(1);
      expect(calls['/api/analyze-pdf']).toBe(2);
      expect(calls['/api/synthesize']).toBe(1);
      expect(saveBriefing).toHaveBeenCalledTimes(1);
      // A's `finally` did not flip B's isRunning while B was still running.
      expect(observedMidRunB).toBe(true);

      const { processing } = useAnalyzerStore.getState();
      expect(processing.isRunning).toBe(false);
      expect(processing.errors).toEqual([]);
    }
  );

  test(
    'Stop cancels the in-flight OAI page instead of waiting it out',
    { timeout: 20000 },
    async () => {
      setupStore();
      let seenSignal = null;
      const calls = installFetch({
        harvest: (opts) => {
          seenSignal = opts.signal;
          return cancellable(
            opts,
            () => ok({ xml: oaiXml(['2610.00001']), resumptionToken: '' }),
            10_000
          );
        },
      });
      const pipeline = makePipeline();

      const started = Date.now();
      const run = pipeline.startProcessing(false, false);
      await sleep(50);
      pressStop(abortControllerRef, pauseRef);
      const outcome = await run;

      expect(outcome).toBe('aborted');
      expect(seenSignal).toBeTruthy();
      expect(seenSignal.aborted).toBe(true);
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(calls['/api/score-abstracts']).toBeUndefined();
    }
  );

  test(
    "Stop alone during the Stage 1 fetch keeps the previous run's results and shows no false error",
    { timeout: 20000 },
    async () => {
      setupStore();
      const store = useAnalyzerStore.getState();
      store.setResults({
        allPapers: [{ id: 'prev-all' }],
        scoredPapers: [{ id: 'prev-scored' }],
        finalRanking: [{ id: 'prev-final' }],
      });
      store.setFilterResults({ total: 1, yes: [{ id: 'prev-yes' }], maybe: [], no: [] });
      const calls = installFetch({
        harvest: (opts) =>
          cancellable(opts, () => ok({ xml: oaiXml(['2610.00001']), resumptionToken: '' }), 1_500),
      });
      const pipeline = makePipeline();

      const run = pipeline.startProcessing(false, false);
      await sleep(50);
      pressStop(abortControllerRef, pauseRef);
      expect(await run).toBe('aborted');
      // Give any straggler continuation a chance to (wrongly) write.
      await sleep(100);

      const { results, filterResults, processing } = useAnalyzerStore.getState();
      expect(results.finalRanking).toEqual([{ id: 'prev-final' }]);
      expect(results.allPapers).toEqual([{ id: 'prev-all' }]);
      expect(results.scoredPapers).toEqual([{ id: 'prev-scored' }]);
      expect(filterResults.yes).toEqual([{ id: 'prev-yes' }]);
      expect(processing.errors).toEqual([]);
      expect(processing.isRunning).toBe(false);
      expect(calls['/api/score-abstracts']).toBeUndefined();
    }
  );

  test(
    'Stop during scoring ends the run without "Check your API configuration" or PDF/briefing calls',
    { timeout: 20000 },
    async () => {
      const saveBriefing = setupStore();
      const calls = installFetch({
        harvest: () => ok({ xml: oaiXml([]), resumptionToken: '' }),
        score: (opts, respond) => cancellable(opts, respond, 10_000),
      });
      const pipeline = makePipeline();

      const run = pipeline.startProcessing(false, true); // TEST_PAPERS: skip Stage 1
      await sleep(80);
      pressStop(abortControllerRef, pauseRef);
      expect(await run).toBe('aborted');

      const { processing } = useAnalyzerStore.getState();
      expect(processing.errors).toEqual([]);
      expect(processing.statusLog.join('\n')).not.toMatch(/retrying/);
      expect(calls['/api/score-abstracts']).toBeGreaterThan(0);
      expect(calls['/api/analyze-pdf']).toBeUndefined();
      expect(calls['/api/synthesize']).toBeUndefined();
      expect(saveBriefing).not.toHaveBeenCalled();
    }
  );

  test(
    'Stop at the pre-briefing gate saves no briefing and reports no error',
    { timeout: 20000 },
    async () => {
      const saveBriefing = setupStore({ pauseBeforeBriefing: true });
      const calls = installFetch({ harvest: () => ok({ xml: oaiXml([]), resumptionToken: '' }) });
      const pipeline = makePipeline();

      const run = pipeline.startProcessing(false, true);
      for (let i = 0; i < 100; i++) {
        if (useAnalyzerStore.getState().processing.stage === 'pre-briefing-review') break;
        await sleep(20);
      }
      expect(useAnalyzerStore.getState().processing.stage).toBe('pre-briefing-review');
      pressStop(abortControllerRef, pauseRef);
      expect(await run).toBe('aborted');

      expect(calls['/api/analyze-pdf-quick']).toBeUndefined();
      expect(calls['/api/synthesize']).toBeUndefined();
      expect(saveBriefing).not.toHaveBeenCalled();
      expect(useAnalyzerStore.getState().processing.errors).toEqual([]);
    }
  );

  test(
    'a stopped dry run reports "cancelled", not "completed successfully"',
    { timeout: 20000 },
    async () => {
      setupStore();
      installFetch({
        harvest: (opts) =>
          cancellable(opts, () => ok({ xml: oaiXml(['2610.00001']), resumptionToken: '' }), 1_500),
      });
      const pipeline = makePipeline();

      const dry = pipeline.runDryRunTest();
      await sleep(50);
      pressStop(abortControllerRef, pauseRef);
      await dry;

      const { processing, testState } = useAnalyzerStore.getState();
      const log = processing.statusLog.join('\n');
      expect(log).toMatch(/Dry run test was cancelled/);
      expect(log).not.toMatch(/completed successfully/);
      expect(testState.dryRunCompleted).toBe(false);
      expect(testState.dryRunInProgress).toBe(false);
    }
  );
});
