// lib/analyzer/rateLimit.js
//
// Shared rate-limiting + worker-pool primitives for Stage 3 (PDF analysis)
// parallelization. Isomorphic (runs in both browser and Next.js API routes)
// so the same class can throttle arXiv downloads server-side and drive
// client-side parallel fan-out.
//
// Design context: docs/superpowers/specs/2026-04-17-pdf-parallelism-design.md

export const ARXIV_DOWNLOAD_DELAY_MS = 5000;
export const ARXIV_MAX_RETRY_AFTER_MS = 60000;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Single-flight throttle: enforces a minimum spacing between acquisitions and
 * optionally honors an externally-signaled Retry-After pause. Thread-safe in a
 * single Node process (Next.js dev-server model). For multi-process deploys,
 * replace the in-memory timestamp with a shared store.
 *
 * Typical use, server-side in an API route:
 *
 *   const throttle = new ArxivDownloadThrottle();   // module-scoped singleton
 *   // inside handler:
 *   await throttle.acquire();
 *   const pdfBytes = await fetchPdf(url);
 *   if (status === 429) throttle.rateLimited({ retryAfterMs });
 */
export class ArxivDownloadThrottle {
  constructor({ minSpacingMs = ARXIV_DOWNLOAD_DELAY_MS } = {}) {
    this.minSpacingMs = minSpacingMs;
    this.nextAvailableAt = 0;
    // Serialize concurrent acquire() calls so they queue in order rather
    // than all racing the same timer.
    this._tail = Promise.resolve();
  }

  async acquire() {
    const prev = this._tail;
    let release;
    this._tail = new Promise((r) => {
      release = r;
    });
    try {
      await prev;
      const now = Date.now();
      const waitMs = Math.max(0, this.nextAvailableAt - now);
      if (waitMs > 0) await sleep(waitMs);
      this.nextAvailableAt = Date.now() + this.minSpacingMs;
    } finally {
      release();
    }
  }

  /**
   * Extend the throttle to respect a provider-signaled Retry-After. Capped at
   * ARXIV_MAX_RETRY_AFTER_MS so a pathological response can't stall
   * indefinitely.
   */
  rateLimited({ retryAfterMs }) {
    const capped = Math.min(Math.max(0, retryAfterMs), ARXIV_MAX_RETRY_AFTER_MS);
    this.nextAvailableAt = Math.max(this.nextAvailableAt, Date.now() + capped);
  }
}

/**
 * N-wide worker pool for client-side fan-out of independent tasks. Tasks are
 * fed from an input array; workers pull the next index atomically.
 *
 * Optional `cacheWarmup` barrier: worker 0 processes its first task alone
 * while workers 1..N-1 block; once worker 0's first task completes, the
 * others are released. Used to avoid parallel cache-create on Anthropic
 * (see spec §3.2 for rationale and "Revisit if" triggers).
 *
 * Task-level exceptions are logged and dropped — each workerFn is expected
 * to handle its own errors internally (e.g. mark the paper as skipped in
 * shared state). Wrap run() in try/catch if you want fail-fast semantics.
 */
export class AnalysisWorkerPool {
  constructor({ concurrency = 3, cacheWarmup = false, abortSignal = null } = {}) {
    this.concurrency = Math.max(1, Math.min(20, concurrency));
    this.cacheWarmup = cacheWarmup;
    this.abortSignal = abortSignal;
  }

  /**
   * Run `workerFn(task, idx)` over every element of `tasks`. Returns when all
   * tasks complete OR the abort signal fires. Tasks are dispatched in input
   * order; completions may arrive out of order.
   */
  async run(tasks, workerFn) {
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    let nextIdx = 0;
    const claim = () => {
      if (this.abortSignal?.aborted) return -1;
      if (nextIdx >= tasks.length) return -1;
      return nextIdx++;
    };

    const warmupBarrier = this.cacheWarmup ? { resolve: null, promise: null } : null;
    if (warmupBarrier) {
      warmupBarrier.promise = new Promise((r) => {
        warmupBarrier.resolve = r;
      });
    }

    const workers = [];
    for (let w = 0; w < this.concurrency; w++) {
      workers.push(this._worker(w, claim, tasks, workerFn, warmupBarrier));
    }
    await Promise.all(workers);
  }

  async _worker(workerIdx, claim, tasks, workerFn, warmupBarrier) {
    // Non-first workers wait for worker 0 to complete its first task before
    // starting, so the cache entry exists and they'll all cache-read.
    if (warmupBarrier && workerIdx > 0) {
      await warmupBarrier.promise;
      if (this.abortSignal?.aborted) return;
    }

    let firstTaskForWorker0 = workerIdx === 0;
    while (true) {
      const idx = claim();
      if (idx < 0) break;
      try {
        await workerFn(tasks[idx], idx);
      } catch (err) {
        // Task-level error: log and move on. The workerFn is expected to
        // have recorded the failure in shared state; the pool keeps running
        // so the remaining tasks can still complete.
        console.warn('AnalysisWorkerPool: task threw', err);
      }
      if (warmupBarrier && workerIdx === 0 && firstTaskForWorker0) {
        firstTaskForWorker0 = false;
        warmupBarrier.resolve();
      }
    }

    // Edge case: if worker 0 never got a chance to claim any task (tasks
    // array empty, or abort fired before the first claim), release the
    // barrier so sibling workers can exit cleanly.
    if (warmupBarrier && workerIdx === 0 && firstTaskForWorker0) {
      warmupBarrier.resolve();
    }
  }
}
