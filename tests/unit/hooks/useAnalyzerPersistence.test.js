import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useAnalyzerPersistence,
  readInitialConfig,
  DEFAULT_CONFIG,
} from '../../../hooks/useAnalyzerPersistence.js';

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
