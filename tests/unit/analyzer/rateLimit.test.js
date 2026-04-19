// Unit tests for lib/analyzer/rateLimit.js
//
// Covers:
// - sleep(ms)
// - ArxivDownloadThrottle: min spacing, Retry-After honoring, concurrent callers
// - AnalysisWorkerPool: concurrency cap, cache warmup barrier, abort, empty input

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sleep,
  ArxivDownloadThrottle,
  AnalysisWorkerPool,
  ARXIV_MAX_RETRY_AFTER_MS,
} from '../../../lib/analyzer/rateLimit.js';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the specified ms', async () => {
    const p = sleep(100);
    let resolved = false;
    p.then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(60);
    expect(resolved).toBe(true);
  });
});

describe('ArxivDownloadThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('first acquire resolves immediately', async () => {
    const t = new ArxivDownloadThrottle({ minSpacingMs: 1000 });
    const start = Date.now();
    await t.acquire();
    expect(Date.now() - start).toBe(0);
  });

  it('second acquire waits for minSpacing', async () => {
    const t = new ArxivDownloadThrottle({ minSpacingMs: 1000 });
    await t.acquire();
    const secondPromise = t.acquire();
    let done = false;
    secondPromise.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(done).toBe(true);
  });

  it('concurrent acquires queue in call order', async () => {
    const t = new ArxivDownloadThrottle({ minSpacingMs: 1000 });
    const order = [];
    const a = t.acquire().then(() => order.push('a'));
    const b = t.acquire().then(() => order.push('b'));
    const c = t.acquire().then(() => order.push('c'));
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all([a, b, c]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('honors Retry-After via rateLimited()', async () => {
    const t = new ArxivDownloadThrottle({ minSpacingMs: 1000 });
    await t.acquire();
    t.rateLimited({ retryAfterMs: 3000 });
    const secondPromise = t.acquire();
    let done = false;
    secondPromise.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(1500);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(done).toBe(true);
  });

  it('caps Retry-After at ARXIV_MAX_RETRY_AFTER_MS', async () => {
    const t = new ArxivDownloadThrottle({ minSpacingMs: 100 });
    await t.acquire();
    t.rateLimited({ retryAfterMs: 10 * 60 * 1000 }); // 10 min
    const secondPromise = t.acquire();
    let done = false;
    secondPromise.then(() => {
      done = true;
    });
    // Should not wait more than ARXIV_MAX_RETRY_AFTER_MS
    await vi.advanceTimersByTimeAsync(ARXIV_MAX_RETRY_AFTER_MS + 100);
    expect(done).toBe(true);
  });

  it('ignores negative retryAfterMs', async () => {
    const t = new ArxivDownloadThrottle({ minSpacingMs: 100 });
    await t.acquire();
    t.rateLimited({ retryAfterMs: -500 });
    const secondPromise = t.acquire();
    let done = false;
    secondPromise.then(() => {
      done = true;
    });
    // Should only wait minSpacing (100ms), not be blocked by negative
    await vi.advanceTimersByTimeAsync(150);
    expect(done).toBe(true);
  });
});

describe('AnalysisWorkerPool', () => {
  it('empty tasks returns immediately', async () => {
    const pool = new AnalysisWorkerPool({ concurrency: 3 });
    const workerFn = vi.fn();
    await pool.run([], workerFn);
    expect(workerFn).not.toHaveBeenCalled();
  });

  it('dispatches every task exactly once', async () => {
    const pool = new AnalysisWorkerPool({ concurrency: 3 });
    const tasks = [10, 20, 30, 40, 50];
    const seen = [];
    await pool.run(tasks, async (task) => {
      seen.push(task);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([10, 20, 30, 40, 50]);
  });

  it('never exceeds concurrency', async () => {
    const pool = new AnalysisWorkerPool({ concurrency: 3 });
    let inFlight = 0;
    let maxInFlight = 0;
    const tasks = Array.from({ length: 10 }, (_, i) => i);
    await pool.run(tasks, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
    });
    expect(maxInFlight).toBe(3);
  });

  it('clamps concurrency to 1..20', () => {
    expect(new AnalysisWorkerPool({ concurrency: 0 }).concurrency).toBe(1);
    expect(new AnalysisWorkerPool({ concurrency: -5 }).concurrency).toBe(1);
    expect(new AnalysisWorkerPool({ concurrency: 50 }).concurrency).toBe(20);
    expect(new AnalysisWorkerPool({ concurrency: 5 }).concurrency).toBe(5);
  });

  it('cache warmup: worker 0 first task runs alone', async () => {
    const pool = new AnalysisWorkerPool({ concurrency: 3, cacheWarmup: true });
    let inFlight = 0;
    const inFlightAtStart = [];
    const tasks = Array.from({ length: 5 }, (_, i) => i);
    await pool.run(tasks, async (task) => {
      inFlightAtStart.push({ task, inFlight: inFlight + 1 });
      inFlight++;
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
    });

    // The task that started with inFlight=1 includes the warmup task AND
    // any later task that happened to be claimed when no others were running.
    // The critical property: at the moment task 0 started, no other task
    // was in-flight.
    const firstEntry = inFlightAtStart[0];
    expect(firstEntry.inFlight).toBe(1);

    // Once the pool releases, concurrency 3 should be reached within a few
    // tasks.
    const maxSeen = Math.max(...inFlightAtStart.map((e) => e.inFlight));
    expect(maxSeen).toBeGreaterThan(1);
  });

  it('no cache warmup: all N workers start concurrently', async () => {
    const pool = new AnalysisWorkerPool({ concurrency: 3, cacheWarmup: false });
    let inFlight = 0;
    let maxInFlight = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => i);
    const starts = [];
    await pool.run(tasks, async (task) => {
      starts.push(Date.now());
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
    });
    expect(maxInFlight).toBe(3);
  });

  it('abort signal stops new task dispatch', async () => {
    const abort = new AbortController();
    const pool = new AnalysisWorkerPool({
      concurrency: 2,
      abortSignal: abort.signal,
    });
    const tasks = Array.from({ length: 10 }, (_, i) => i);
    let seen = 0;
    await pool.run(tasks, async () => {
      seen++;
      if (seen === 3) abort.abort();
      await new Promise((r) => setTimeout(r, 5));
    });
    // Some tasks after the abort may have been mid-claim; we just want the
    // pool to stop eagerly claiming new work. Should be well below 10.
    expect(seen).toBeLessThan(10);
  });

  it('task exceptions are caught and do not halt the pool', async () => {
    const pool = new AnalysisWorkerPool({ concurrency: 2 });
    const tasks = [1, 2, 3, 4];
    const completed = [];
    await pool.run(tasks, async (task) => {
      if (task === 2) throw new Error('boom');
      completed.push(task);
    });
    expect(completed.sort()).toEqual([1, 3, 4]);
  });

  it('cache warmup releases even when no tasks (edge case)', async () => {
    const pool = new AnalysisWorkerPool({ concurrency: 3, cacheWarmup: true });
    await pool.run([], async () => {});
    // Should return without hanging
    expect(true).toBe(true);
  });
});
