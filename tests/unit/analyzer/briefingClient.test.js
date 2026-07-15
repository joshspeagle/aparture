import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  callCheckBriefing,
  callSynthesize,
  generateQuickSummaries,
  runBriefingGeneration,
} from '../../../lib/analyzer/briefingClient.js';
import { getLLMBarrier, _resetLLMBarriers } from '../../../lib/analyzer/rateLimit.js';

beforeEach(() => {
  _resetLLMBarriers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseArgs = {
  briefingObj: { executiveSummary: 'x', themes: [] },
  papers: [{ arxivId: '2605.0001', title: 'T', abstract: 'A', fullReport: 'R' }],
  quickById: {},
  provider: 'anthropic',
  modelId: 'claude-haiku-4.5',
  password: 'pw',
};

describe('callCheckBriefing — non-fatal contract', () => {
  it('returns the parsed verdict on a successful JSON response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ verdict: 'NO', justification: 'grounded' }),
    });
    const result = await callCheckBriefing(baseArgs);
    expect(result).toEqual({ verdict: 'NO', justification: 'grounded' });
  });

  it('returns null (does not throw) when a non-ok response has a non-JSON body', async () => {
    // Simulates a gateway 502/504 returning an HTML body — res.json() throws.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    });
    await expect(callCheckBriefing(baseArgs)).resolves.toBeNull();
  });

  it('returns null (does not throw) when an OK response has a non-JSON body', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('not json');
      },
    });
    await expect(callCheckBriefing(baseArgs)).resolves.toBeNull();
  });

  it('returns null on a non-ok response with a valid JSON error body', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'check failed' }),
    });
    await expect(callCheckBriefing(baseArgs)).resolves.toBeNull();
  });
});

describe('callSynthesize — no-structured-output retry', () => {
  const synthArgs = {
    profile: 'my profile',
    papers: [{ arxivId: '2605.0001', title: 'T' }],
    provider: 'anthropic',
    modelId: 'claude-sonnet-5',
    password: 'pw',
  };

  const okResponse = (briefing) => ({
    ok: true,
    status: 200,
    json: async () => ({ briefing }),
  });

  const noStructuredResponse = () => ({
    ok: false,
    status: 502,
    json: async () => ({ error: 'model did not return structured output' }),
  });

  it('retries once when the route reports missing structured output', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(noStructuredResponse())
      .mockResolvedValueOnce(okResponse({ executiveSummary: 'second try' }));

    const result = await callSynthesize(synthArgs);
    expect(result.briefing.executiveSummary).toBe('second try');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry more than once — a second miss surfaces as an error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(noStructuredResponse())
      .mockResolvedValueOnce(noStructuredResponse());

    await expect(callSynthesize(synthArgs)).rejects.toThrow(
      'model did not return structured output'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry other 502s — the original error message surfaces', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'briefing validation failed', details: 'bad citation' }),
    });

    await expect(callSynthesize(synthArgs)).rejects.toThrow('bad citation');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-502 failures (429 propagates as a rate-limit error)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ provider: 'anthropic', retryAfterMs: 3000 }),
    });

    await expect(callSynthesize(synthArgs)).rejects.toThrow(/rate limited/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the parsed briefing on first success without extra calls', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse({ executiveSummary: 'first try' }));

    const result = await callSynthesize(synthArgs);
    expect(result.briefing.executiveSummary).toBe('first try');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('generateQuickSummaries — retry, barrier, and failure surfacing (P1-7)', () => {
  const twoPapers = [
    { arxivId: '2605.0001', title: 'A', fullReport: 'Report A' },
    { arxivId: '2605.0002', title: 'B', fullReport: 'Report B' },
  ];

  it('retries a failed quick summary once and keeps the batch result', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Per-paper: first call 500s, retry succeeds.
    const attemptsByPaper = new Map();
    vi.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
      const body = JSON.parse(options.body);
      const id = body.paper.arxivId;
      const attempt = (attemptsByPaper.get(id) ?? 0) + 1;
      attemptsByPaper.set(id, attempt);
      if (attempt === 1) {
        return { ok: false, status: 500, json: async () => ({ error: 'transient blip' }) };
      }
      return { ok: true, status: 200, json: async () => ({ quickSummary: `summary-${id}` }) };
    });

    const addStatus = vi.fn();
    const quickById = await generateQuickSummaries({
      papers: twoPapers,
      provider: 'google',
      modelId: 'gemini-3.1-pro',
      password: 'pw',
      concurrency: 2,
      abortSignal: null,
      addStatus,
    });

    // The old behavior had no retry: both summaries were silently lost.
    expect(quickById).toEqual({
      '2605.0001': 'summary-2605.0001',
      '2605.0002': 'summary-2605.0002',
    });
    // Nothing failed after the retry, so no warning is emitted.
    expect(addStatus).not.toHaveBeenCalled();
  });

  it('surfaces an "N/M quick summaries failed" status when retries are exhausted', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'route exploded' }),
    });

    const addStatus = vi.fn();
    const quickById = await generateQuickSummaries({
      papers: twoPapers,
      provider: 'google',
      modelId: 'gemini-3.1-pro',
      password: 'pw',
      concurrency: 2,
      abortSignal: null,
      addStatus,
    });

    expect(quickById).toEqual({});
    // 2 attempts per paper (initial + one retry), never more.
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(addStatus).toHaveBeenCalledWith(expect.stringMatching(/2\/2 quick summaries failed/));
  });

  it('a 429 signals the shared per-provider barrier with the route retryAfterMs', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const barrier = getLLMBarrier('google');
    const rateLimitedSpy = vi.spyOn(barrier, 'rateLimited');

    let calls = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ provider: 'google', retryAfterMs: 25 }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ quickSummary: 'ok-after-429' }) };
    });

    const addStatus = vi.fn();
    const quickById = await generateQuickSummaries({
      papers: [twoPapers[0]],
      provider: 'google',
      modelId: 'gemini-3.1-pro',
      password: 'pw',
      concurrency: 1,
      abortSignal: null,
      addStatus,
    });

    // Barrier signaled so sibling pipeline workers pause too, then the
    // retry (after the Retry-After window) succeeds.
    expect(rateLimitedSpy).toHaveBeenCalledWith({ retryAfterMs: 25 });
    expect(quickById).toEqual({ '2605.0001': 'ok-after-429' });
    expect(addStatus).not.toHaveBeenCalled();
  });

  it('skips papers without a fullReport and reports failures against the attempted count', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });

    const addStatus = vi.fn();
    await generateQuickSummaries({
      papers: [...twoPapers, { arxivId: '2605.0003', title: 'C', fullReport: '' }],
      provider: 'google',
      modelId: 'gemini-3.1-pro',
      password: 'pw',
      concurrency: 2,
      abortSignal: null,
      addStatus,
    });

    // Denominator is papers WITH reports (2), not all papers (3).
    expect(addStatus).toHaveBeenCalledWith(expect.stringMatching(/2\/2 quick summaries failed/));
  });
});

describe('runBriefingGeneration — abort handling', () => {
  it('re-throws the pipeline abort shape instead of recording a synthesis error', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const setters = {
      setSynthesizing: vi.fn(),
      setSynthesisError: vi.fn(),
      setBriefingCheckResult: vi.fn(),
      setBriefingStage: vi.fn(),
      setQuickSummariesById: vi.fn(),
      setFullReportsById: vi.fn(),
    };
    const saveBriefing = vi.fn();

    await expect(
      runBriefingGeneration({
        results: {
          finalRanking: [{ arxivId: '2605.0001', title: 'T', abstract: 'A', score: 8 }],
        },
        briefingModel: 'gemini-3.1-pro',
        profile: { content: 'profile' },
        password: 'pw',
        saveBriefing,
        abortSignal: { aborted: true },
        ...setters,
      })
    ).rejects.toThrow('Operation aborted');

    // Abort is not a failure: no error recorded, nothing persisted, no LLM
    // routes called, and the synthesizing flag is cleared on the way out.
    expect(setters.setSynthesisError).toHaveBeenCalledTimes(1); // only the initial null reset
    expect(setters.setSynthesisError).toHaveBeenCalledWith(null);
    expect(saveBriefing).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setters.setSynthesizing).toHaveBeenLastCalledWith(false);
  });
});
