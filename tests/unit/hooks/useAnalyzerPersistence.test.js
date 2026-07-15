import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useAnalyzerPersistence,
  readInitialConfig,
  DEFAULT_CONFIG,
  migrateLegacyConfig,
} from '../../../hooks/useAnalyzerPersistence.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

const STORAGE_KEY = 'arxivAnalyzerState';

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: 'sess-x', bytesWritten: 0 }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeProps(overrides = {}) {
  return {
    config: { selectedCategories: ['cs.AI'], filterModel: 'gemini-3-flash' },
    results: { allPapers: [], scoredPapers: [], finalRanking: [] },
    filterResults: { total: 0, yes: [], maybe: [], no: [] },
    processingTiming: {},
    testState: {},
    podcastDuration: '15min',
    notebookLMModel: 'standard',
    notebookLMContent: null,
    password: 'test-pw',
    isAuthenticated: true,
    setResults: vi.fn(),
    setFilterResults: vi.fn(),
    setProcessingTiming: vi.fn(),
    setTestState: vi.fn(),
    setPodcastDuration: vi.fn(),
    setNotebookLMModel: vi.fn(),
    setNotebookLMContent: vi.fn(),
    setPassword: vi.fn(),
    setIsAuthenticated: vi.fn(),
    ...overrides,
  };
}

describe('readInitialConfig', () => {
  it('returns DEFAULT_CONFIG when storage is empty', () => {
    expect(readInitialConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('restores config from a tiered hot blob', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        config: { ...DEFAULT_CONFIG, selectedCategories: ['stat.ML'] },
        sessionId: 'sess-1',
      })
    );
    expect(readInitialConfig().selectedCategories).toEqual(['stat.ML']);
  });

  it('restores config from a legacy blob (results inline)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        config: { ...DEFAULT_CONFIG, daysBack: 7 },
        results: { allPapers: [{ id: '1' }] },
      })
    );
    expect(readInitialConfig().daysBack).toBe(7);
  });
});

describe('useAnalyzerPersistence — DEFAULT_CONFIG', () => {
  it('default maxRetries is 4 (5 attempts) for the new exponential-backoff retry ladder', () => {
    expect(DEFAULT_CONFIG.maxRetries).toBe(4);
  });
});

describe('useAnalyzerPersistence — save effect', () => {
  it('does NOT persist heavy fields (allPapers, scoredPapers, full verdicts) to localStorage', async () => {
    vi.useFakeTimers();
    const props = makeProps({
      results: {
        allPapers: [{ id: '1', abstract: 'a'.repeat(1000) }],
        scoredPapers: [{ id: '1', score: 7 }],
        finalRanking: [{ id: '1', finalScore: 8 }],
      },
      filterResults: {
        total: 100,
        yes: [{ id: '1' }, { id: '2' }],
        maybe: [{ id: '3' }],
        no: [{ id: '4' }],
      },
    });
    renderHook(() => useAnalyzerPersistence(props));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(stored.results.allPapers).toBeUndefined();
    expect(stored.results.scoredPapers).toBeUndefined();
    expect(stored.results.finalRanking).toEqual([{ id: '1', finalScore: 8 }]);
    expect(stored.filterResults.yes).toBeUndefined();
    expect(stored.filterResults.yesCount).toBe(2);
    expect(stored.filterResults.maybeCount).toBe(1);
    expect(stored.filterResults.noCount).toBe(1);
    vi.useRealTimers();
  });

  it('POSTs full payload to /api/sessions (cold tier)', async () => {
    vi.useFakeTimers();
    const props = makeProps({
      results: {
        allPapers: [{ id: '1' }],
        scoredPapers: [{ id: '1' }],
        finalRanking: [],
      },
    });
    renderHook(() => useAnalyzerPersistence(props));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const postCall = global.fetch.mock.calls.find(
      (call) => call[0] === '/api/sessions' && call[1]?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall[1].body);
    expect(body.password).toBe('test-pw');
    expect(body.entry.id).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(body.entry.results.allPapers).toEqual([{ id: '1' }]);
    vi.useRealTimers();
  });

  it('survives QuotaExceededError without crashing (warns instead)', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new DOMException('quota', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw err;
    });

    const props = makeProps({
      results: {
        allPapers: [{ id: '1' }],
        scoredPapers: [],
        finalRanking: [],
      },
    });
    renderHook(() => useAnalyzerPersistence(props));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.some((call) => /quota/i.test(call[0]))).toBe(true);
    vi.useRealTimers();
  });

  it('reuses sessionId across saves so cold writes overwrite in place', async () => {
    vi.useFakeTimers();
    const props = makeProps({
      results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
    });
    const { rerender } = renderHook((p) => useAnalyzerPersistence(p), { initialProps: props });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const firstId = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).sessionId;

    rerender(
      makeProps({
        ...props,
        results: { allPapers: [{ id: '1' }, { id: '2' }], scoredPapers: [], finalRanking: [] },
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    const secondId = JSON.parse(window.localStorage.getItem(STORAGE_KEY)).sessionId;
    expect(secondId).toBe(firstId);
    vi.useRealTimers();
  });

  it('skips cold POST when not authenticated', async () => {
    vi.useFakeTimers();
    const props = makeProps({
      isAuthenticated: false,
      password: '',
      results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
    });
    renderHook(() => useAnalyzerPersistence(props));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    const postCall = global.fetch.mock.calls.find(
      (call) => call[0] === '/api/sessions' && call[1]?.method === 'POST'
    );
    expect(postCall).toBeUndefined();
    vi.useRealTimers();
  });
});

describe('useAnalyzerPersistence — load effect', () => {
  it('restores legacy (full inline) blob without fetching cold tier', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        config: DEFAULT_CONFIG,
        results: {
          allPapers: [{ id: '1', title: 't' }],
          scoredPapers: [],
          finalRanking: [],
        },
        filterResults: { total: 1, yes: [{ id: '1' }], maybe: [], no: [] },
      })
    );
    const props = makeProps();
    renderHook(() => useAnalyzerPersistence(props));

    await waitFor(() => {
      expect(props.setResults).toHaveBeenCalled();
    });
    expect(props.setResults).toHaveBeenCalledWith(
      expect.objectContaining({ allPapers: [{ id: '1', title: 't' }] })
    );
    // No cold-tier GET because allPapers was inline
    const getCall = global.fetch.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('/api/sessions/')
    );
    expect(getCall).toBeUndefined();
  });

  it('lazy-loads cold tier when hot blob has sessionId but no allPapers', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        config: DEFAULT_CONFIG,
        sessionId: 'sess-abc',
        results: { finalRanking: [{ id: '1', finalScore: 8 }] },
        filterResults: { total: 100, yesCount: 5, maybeCount: 3, noCount: 92 },
        password: 'test-pw',
      })
    );
    global.fetch.mockImplementation(async (url) => {
      if (url.startsWith('/api/sessions/sess-abc')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'sess-abc',
            results: {
              allPapers: [{ id: '1' }, { id: '2' }],
              scoredPapers: [{ id: '1', score: 9 }],
              finalRanking: [{ id: '1', finalScore: 8 }],
            },
            filterResults: {
              total: 100,
              yes: [{ id: '1' }],
              maybe: [{ id: '3' }],
              no: [{ id: '4' }],
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const props = makeProps();
    renderHook(() => useAnalyzerPersistence(props));

    await waitFor(() => {
      const setResultsArgs = props.setResults.mock.calls.flat();
      const lastCall = setResultsArgs[setResultsArgs.length - 1];
      const resolved = typeof lastCall === 'function' ? lastCall({ finalRanking: [] }) : lastCall;
      expect(resolved.allPapers).toEqual([{ id: '1' }, { id: '2' }]);
    });
  });
});

describe('useAnalyzerPersistence — reload-time cold-tier clobber guard', () => {
  // Hot blob shape after a refresh: sessionId + finalRanking + password, but
  // NO heavy fields (those live only on disk). Restoring it re-triggers the
  // save effect; the cold POST must wait for the mount-time cold GET to settle
  // or it would overwrite the on-disk heavy data with empty arrays.
  function seedTieredHotBlob() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        config: DEFAULT_CONFIG,
        sessionId: 'sess-abc',
        results: { finalRanking: [{ id: '1', finalScore: 8 }] },
        filterResults: { total: 100, yesCount: 5, maybeCount: 3, noCount: 92 },
        password: 'test-pw',
      })
    );
  }

  function postCalls() {
    return global.fetch.mock.calls.filter(
      (call) => call[0] === '/api/sessions' && call[1]?.method === 'POST'
    );
  }

  afterEach(() => {
    useAnalyzerStore.setState(initialState());
  });

  it('holds the cold POST while the mount-time cold GET is still in flight', async () => {
    vi.useFakeTimers();
    seedTieredHotBlob();
    // Cold GET never resolves within the test — simulates a slow disk read.
    let releaseCold;
    const coldGate = new Promise((resolve) => {
      releaseCold = resolve;
    });
    global.fetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.startsWith('/api/sessions/sess-abc')) {
        await coldGate;
        return { ok: true, status: 200, json: async () => ({ id: 'sess-abc', results: {} }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    // In-memory state mirrors the hot restore: finalRanking + password present,
    // heavy fields EMPTY — exactly the payload that used to clobber disk.
    const props = makeProps({
      results: { allPapers: [], scoredPapers: [], finalRanking: [{ id: '1', finalScore: 8 }] },
    });
    renderHook(() => useAnalyzerPersistence(props));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Debounce elapsed, but the cold GET hasn't settled → no POST fired.
    expect(postCalls()).toHaveLength(0);
    // Hot tier still saved normally.
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).sessionId).toBe('sess-abc');
    releaseCold();
    vi.useRealTimers();
  });

  it('after a FAILED cold GET for an adopted sessionId, skips empty-heavy POSTs but allows real-data saves', async () => {
    vi.useFakeTimers();
    seedTieredHotBlob();
    global.fetch.mockImplementation(async (url, opts) => {
      if (typeof url === 'string' && url.startsWith('/api/sessions/sess-abc') && !opts?.method) {
        // Mount-time cold GET fails — the on-disk file may still hold heavy data.
        return { ok: false, status: 500, json: async () => ({ error: 'boom' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const emptyHeavyProps = makeProps({
      results: { allPapers: [], scoredPapers: [], finalRanking: [{ id: '1', finalScore: 8 }] },
    });
    const { rerender } = renderHook((p) => useAnalyzerPersistence(p), {
      initialProps: emptyHeavyProps,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Settled (GET failed) but the payload's heavy fields are all empty →
    // POST is skipped so the adopted on-disk file is not clobbered.
    expect(postCalls()).toHaveLength(0);

    // A run produces real heavy data → save proceeds normally.
    rerender(
      makeProps({
        ...emptyHeavyProps,
        results: { allPapers: [{ id: '9' }], scoredPapers: [], finalRanking: [] },
      })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(postCalls().length).toBeGreaterThan(0);
    const body = JSON.parse(postCalls()[0][1].body);
    expect(body.entry.results.allPapers).toEqual([{ id: '9' }]);
    vi.useRealTimers();
  });

  it('POSTs normally after a SUCCESSFUL cold load settles', async () => {
    vi.useFakeTimers();
    seedTieredHotBlob();
    global.fetch.mockImplementation(async (url, opts) => {
      if (typeof url === 'string' && url.startsWith('/api/sessions/sess-abc') && !opts?.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'sess-abc',
            results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const props = makeProps({
      results: { allPapers: [], scoredPapers: [], finalRanking: [{ id: '1', finalScore: 8 }] },
    });
    const { rerender } = renderHook((p) => useAnalyzerPersistence(p), { initialProps: props });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // The merged state lands via setResults in the real app; mirror it here.
    rerender(
      makeProps({
        ...props,
        results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
      })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(postCalls().length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('fresh runs (no stored blob) still save normally — gate settles synchronously on mount', async () => {
    vi.useFakeTimers();
    const props = makeProps({
      results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
    });
    renderHook(() => useAnalyzerPersistence(props));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(postCalls()).toHaveLength(1);
    vi.useRealTimers();
  });

  it('skips the cold-tier merge when a run is already in progress at GET-resolve time', async () => {
    seedTieredHotBlob();
    let resolvedColdGet = false;
    global.fetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.startsWith('/api/sessions/sess-abc')) {
        resolvedColdGet = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'sess-abc',
            results: { allPapers: [{ id: 'stale' }], scoredPapers: [], finalRanking: [] },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    // A new run started before the GET resolved.
    useAnalyzerStore.setState({
      processing: { ...useAnalyzerStore.getState().processing, isRunning: true },
    });

    const props = makeProps();
    renderHook(() => useAnalyzerPersistence(props));

    await waitFor(() => expect(resolvedColdGet).toBe(true));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Hot restore called setResults with the plain parsed object; the cold
    // merge would have called it with an updater FUNCTION. None allowed here.
    const updaterCalls = props.setResults.mock.calls.filter(
      (call) => typeof call[0] === 'function'
    );
    expect(updaterCalls).toHaveLength(0);
  });
});

describe('useAnalyzerPersistence — onColdSessionSaved callback', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'sess-1', bytesWritten: 0 }),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('invokes onColdSessionSaved with allPapers and timestamp after a successful cold-tier POST', async () => {
    const onColdSessionSaved = vi.fn();
    const allPapers = [{ id: '2605.14205' }, { id: '2605.14210' }];

    const { rerender } = renderHook(
      (props) =>
        useAnalyzerPersistence({
          config: { version: 6 },
          results: { allPapers, scoredPapers: [], finalRanking: [] },
          filterResults: { total: 0, yes: [], maybe: [], no: [] },
          processingTiming: {},
          testState: {},
          podcastDuration: 20,
          notebookLMModel: '',
          notebookLMContent: null,
          password: 'pw',
          isAuthenticated: true,
          setResults: () => {},
          setFilterResults: () => {},
          setProcessingTiming: () => {},
          setTestState: () => {},
          setPodcastDuration: () => {},
          setNotebookLMModel: () => {},
          setNotebookLMContent: () => {},
          setPassword: () => {},
          setIsAuthenticated: () => {},
          onColdSessionSaved,
          ...props,
        }),
      { initialProps: {} }
    );

    // Advance past the 400ms debounce.
    await act(async () => {
      vi.advanceTimersByTime(500);
      // let the fetch promise resolve
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onColdSessionSaved).toHaveBeenCalled();
    const [papersArg, tsArg] = onColdSessionSaved.mock.calls[0];
    expect(papersArg.map((p) => p.id)).toEqual(['2605.14205', '2605.14210']);
    expect(typeof tsArg).toBe('number');
    rerender({});
  });

  it('does not invoke onColdSessionSaved when cold-tier POST fails', async () => {
    const onColdSessionSaved = vi.fn();
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() =>
      useAnalyzerPersistence({
        config: { version: 6 },
        results: { allPapers: [{ id: '2605.14205' }], scoredPapers: [], finalRanking: [] },
        filterResults: { total: 0, yes: [], maybe: [], no: [] },
        processingTiming: {},
        testState: {},
        podcastDuration: 20,
        notebookLMModel: '',
        notebookLMContent: null,
        password: 'pw',
        isAuthenticated: true,
        setResults: () => {},
        setFilterResults: () => {},
        setProcessingTiming: () => {},
        setTestState: () => {},
        setPodcastDuration: () => {},
        setNotebookLMModel: () => {},
        setNotebookLMContent: () => {},
        setPassword: () => {},
        setIsAuthenticated: () => {},
        onColdSessionSaved,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onColdSessionSaved).not.toHaveBeenCalled();
  });
});

describe('useAnalyzerPersistence — cold-save retry + warning', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('fails fast (exactly one POST, no retries) on a non-retryable 413 and still warns', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 413 Payload Too Large: an oversized body can't shrink on retry, so the
    // helper must give up immediately rather than burn the backoff ladder.
    const failingFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ error: 'payload too large' }),
    });
    const onColdSaveFailed = vi.fn();

    const props = makeProps({
      results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
      onColdSaveFailed,
    });
    renderHook(() => useAnalyzerPersistence(props));

    // Advance past the 400ms debounce, then drain any (non-)backoff. A
    // fail-fast path makes a single POST and never schedules a backoff timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(2000);
    });

    const postCalls = failingFetch.mock.calls.filter(
      (call) => call[0] === '/api/sessions' && call[1]?.method === 'POST'
    );
    // Exactly ONE attempt — no retries on a permanent client error.
    expect(postCalls.length).toBe(1);
    expect(onColdSaveFailed).toHaveBeenCalledTimes(1);
    expect(onColdSaveFailed.mock.calls[0][0]).toMatch(/could not be saved|lost if you refresh/i);
    vi.useRealTimers();
  });

  it('retries up to the cap and fires onColdSaveFailed on a persistent transient (500) failure', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 500 is transient/retryable; the full ladder (3 attempts) must run before
    // surfacing the warning.
    const failingFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal error' }),
    });
    const onColdSaveFailed = vi.fn();

    const props = makeProps({
      results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
      onColdSaveFailed,
    });
    renderHook(() => useAnalyzerPersistence(props));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(2000);
    });

    const postCalls = failingFetch.mock.calls.filter(
      (call) => call[0] === '/api/sessions' && call[1]?.method === 'POST'
    );
    // 3 attempts (COLD_SAVE_MAX_ATTEMPTS) for a retryable status.
    expect(postCalls.length).toBe(3);
    expect(onColdSaveFailed).toHaveBeenCalledTimes(1);
    expect(onColdSaveFailed.mock.calls[0][0]).toMatch(/could not be saved|lost if you refresh/i);
    vi.useRealTimers();
  });

  it('does NOT fire onColdSaveFailed when a retry eventually succeeds', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let attempt = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async (url, opts) => {
      if (url === '/api/sessions' && opts?.method === 'POST') {
        attempt += 1;
        if (attempt < 2) {
          return { ok: false, status: 503, json: async () => ({ error: 'busy' }) };
        }
        return { ok: true, status: 200, json: async () => ({ id: 'sess-x' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    const onColdSaveFailed = vi.fn();

    const props = makeProps({
      results: { allPapers: [{ id: '1' }], scoredPapers: [], finalRanking: [] },
      onColdSaveFailed,
    });
    renderHook(() => useAnalyzerPersistence(props));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(attempt).toBe(2);
    expect(onColdSaveFailed).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('migrateLegacyConfig — v7 → v8', () => {
  it('adds pauseBeforeDeepAnalysis: true for v7 configs', () => {
    const v7Config = {
      version: 7,
      pauseAfterFilter: true,
      pauseBeforeBriefing: true,
      removeDuplicates: true,
    };
    const result = migrateLegacyConfig(v7Config);
    expect(result.pauseBeforeDeepAnalysis).toBe(true);
    // Migrations chain: v7 configs land on the current version.
    expect(result.version).toBe(DEFAULT_CONFIG.version);
  });
  it('preserves existing pauseBeforeDeepAnalysis if already set', () => {
    const config = { version: 7, pauseBeforeDeepAnalysis: false };
    const result = migrateLegacyConfig(config);
    expect(result.pauseBeforeDeepAnalysis).toBe(false);
  });
});

describe('migrateLegacyConfig — v8 → v9 (removed Anthropic model remap)', () => {
  it('remaps every removed Anthropic ID across all model slots', () => {
    const v8Config = {
      version: 8,
      filterModel: 'claude-haiku-3.5',
      scoringModel: 'claude-sonnet-4.5',
      postProcessingModel: 'claude-opus-4.5',
      pdfModel: 'claude-opus-4.1',
      briefingModel: 'claude-opus-4.5',
      quickSummaryModel: 'claude-haiku-3.5',
      notebookLMModel: 'claude-sonnet-4.5',
    };
    const result = migrateLegacyConfig(v8Config);
    expect(result.version).toBe(9);
    expect(result.filterModel).toBe('claude-haiku-4.5');
    expect(result.scoringModel).toBe('claude-sonnet-5');
    expect(result.postProcessingModel).toBe('claude-opus-4-8');
    expect(result.pdfModel).toBe('claude-opus-4-8');
    expect(result.briefingModel).toBe('claude-opus-4-8');
    expect(result.quickSummaryModel).toBe('claude-haiku-4.5');
    expect(result.notebookLMModel).toBe('claude-sonnet-5');
  });

  it('leaves still-registered model selections untouched', () => {
    const v8Config = {
      version: 8,
      filterModel: 'gemini-3.1-flash-lite',
      scoringModel: 'gemini-3-flash',
      pdfModel: 'gemini-3.1-pro',
      briefingModel: 'claude-opus-4.7',
      quickSummaryModel: 'gpt-5.4-nano',
    };
    const result = migrateLegacyConfig(v8Config);
    expect(result.version).toBe(9);
    // Preview Google IDs still work; explicit user selections are preserved.
    expect(result.filterModel).toBe('gemini-3.1-flash-lite');
    expect(result.scoringModel).toBe('gemini-3-flash');
    expect(result.pdfModel).toBe('gemini-3.1-pro');
    expect(result.briefingModel).toBe('claude-opus-4.7');
    expect(result.quickSummaryModel).toBe('gpt-5.4-nano');
  });

  it('chains from older versions through the remap (v7 with a retired model)', () => {
    const v7Config = { version: 7, pdfModel: 'claude-opus-4.1' };
    const result = migrateLegacyConfig(v7Config);
    expect(result.version).toBe(9);
    expect(result.pauseBeforeDeepAnalysis).toBe(true);
    expect(result.pdfModel).toBe('claude-opus-4-8');
  });
});

describe('DEFAULT_CONFIG', () => {
  it('includes pauseBeforeDeepAnalysis: true', () => {
    expect(DEFAULT_CONFIG.pauseBeforeDeepAnalysis).toBe(true);
  });

  it('defaults model slots to GA models (no preview-only heavy slots)', () => {
    expect(DEFAULT_CONFIG.version).toBe(9);
    expect(DEFAULT_CONFIG.scoringModel).toBe('gemini-3.5-flash');
    expect(DEFAULT_CONFIG.postProcessingModel).toBe('gemini-3.5-flash');
    expect(DEFAULT_CONFIG.pdfModel).toBe('gemini-3.5-flash');
    expect(DEFAULT_CONFIG.briefingModel).toBe('gemini-3.5-flash');
  });
});
