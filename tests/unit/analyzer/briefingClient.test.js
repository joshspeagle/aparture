import { describe, it, expect, vi, afterEach } from 'vitest';
import { callCheckBriefing, runBriefingGeneration } from '../../../lib/analyzer/briefingClient.js';

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
