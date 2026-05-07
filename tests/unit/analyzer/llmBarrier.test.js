import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LLMRateLimitBarrier,
  AnalysisWorkerPool,
  getLLMBarrier,
  _resetLLMBarriers,
  LLM_MAX_RETRY_AFTER_MS,
} from '../../../lib/analyzer/rateLimit.js';

beforeEach(() => {
  _resetLLMBarriers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('LLMRateLimitBarrier', () => {
  it('acquire() returns immediately when not rate-limited', async () => {
    const b = new LLMRateLimitBarrier();
    const before = Date.now();
    await b.acquire();
    expect(Date.now() - before).toBeLessThan(50);
  });

  it('acquire() waits at least retryAfterMs after rateLimited()', async () => {
    vi.useFakeTimers();
    const b = new LLMRateLimitBarrier();
    b.rateLimited({ retryAfterMs: 5000 });
    let resolved = false;
    const p = b.acquire().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(4500);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    await p;
    expect(resolved).toBe(true);
  });

  it('caps retry-after at LLM_MAX_RETRY_AFTER_MS', async () => {
    vi.useFakeTimers();
    const b = new LLMRateLimitBarrier();
    b.rateLimited({ retryAfterMs: 600000 }); // 10 minutes
    let resolved = false;
    const p = b.acquire().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(LLM_MAX_RETRY_AFTER_MS + 100);
    await p;
    expect(resolved).toBe(true);
  });

  it('multiple rateLimited() calls take the longest pause (not additive)', async () => {
    vi.useFakeTimers();
    const b = new LLMRateLimitBarrier();
    b.rateLimited({ retryAfterMs: 2000 });
    b.rateLimited({ retryAfterMs: 5000 });
    b.rateLimited({ retryAfterMs: 1000 }); // shorter, ignored
    let resolved = false;
    const p = b.acquire().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(4900);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await p;
    expect(resolved).toBe(true);
  });

  it('handles null/undefined retryAfterMs gracefully', () => {
    const b = new LLMRateLimitBarrier();
    expect(() => b.rateLimited({ retryAfterMs: null })).not.toThrow();
    expect(() => b.rateLimited({ retryAfterMs: undefined })).not.toThrow();
    expect(b.pausedUntil).toBeLessThanOrEqual(Date.now());
  });
});

describe('getLLMBarrier', () => {
  it('returns the same barrier instance for the same provider', () => {
    const a1 = getLLMBarrier('google');
    const a2 = getLLMBarrier('google');
    expect(a1).toBe(a2);
  });

  it('is case-insensitive on provider key', () => {
    const a = getLLMBarrier('Anthropic');
    const b = getLLMBarrier('anthropic');
    expect(a).toBe(b);
  });

  it('returns separate barriers per provider', () => {
    const g = getLLMBarrier('google');
    const a = getLLMBarrier('anthropic');
    const o = getLLMBarrier('openai');
    expect(g).not.toBe(a);
    expect(a).not.toBe(o);
  });
});

describe('AnalysisWorkerPool barrierFor integration', () => {
  it('awaits the barrier before each workerFn call when barrierFor is set', async () => {
    vi.useFakeTimers();
    const barrier = new LLMRateLimitBarrier();
    barrier.rateLimited({ retryAfterMs: 3000 });
    const seen = [];
    const pool = new AnalysisWorkerPool({
      concurrency: 2,
      barrierFor: () => barrier,
    });
    const tasks = [{ id: 'a' }, { id: 'b' }];
    const workerFn = async (task) => {
      seen.push(task.id);
    };
    const runPromise = pool.run(tasks, workerFn);
    // Before timer advances, no workers should have run.
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(3100);
    await runPromise;
    expect(seen).toContain('a');
    expect(seen).toContain('b');
  });

  it('does not block when barrierFor returns null', async () => {
    const seen = [];
    const pool = new AnalysisWorkerPool({
      concurrency: 2,
      barrierFor: () => null,
    });
    await pool.run([{ id: 'a' }], async (t) => {
      seen.push(t.id);
    });
    expect(seen).toEqual(['a']);
  });

  it('preserves existing behavior when barrierFor is not set', async () => {
    const seen = [];
    const pool = new AnalysisWorkerPool({ concurrency: 2 });
    await pool.run([{ id: 'a' }, { id: 'b' }], async (t) => {
      seen.push(t.id);
    });
    expect(seen.sort()).toEqual(['a', 'b']);
  });
});
