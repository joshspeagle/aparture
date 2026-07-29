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
export const LLM_MAX_RETRY_AFTER_MS = 60000;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Abort-aware sleep: resolves early (without throwing) when the signal fires.
// Falls back to a plain sleep for duck-typed `{aborted}` test stand-ins that
// lack addEventListener — callers re-check `signal.aborted` in their loop.
function sleepUnlessAborted(ms, signal) {
  if (!signal || typeof signal.addEventListener !== 'function') return sleep(ms);
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
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
      // Loop, re-reading nextAvailableAt each iteration: a sibling's
      // rateLimited() may land mid-sleep and extend the deadline. A single
      // snapshotted sleep would wake too early and ignore the extension.
      // Same pattern as LLMRateLimitBarrier.acquire below.
      while (true) {
        const waitMs = this.nextAvailableAt - Date.now();
        if (waitMs <= 0) break;
        await sleep(waitMs);
      }
      // Math.max so a Retry-After deadline signaled during the final sleep
      // isn't clobbered by the regular min-spacing bump.
      this.nextAvailableAt = Math.max(this.nextAvailableAt, Date.now() + this.minSpacingMs);
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
 * Per-provider barrier for LLM rate-limit cascades. When one of N concurrent
 * workers (filter / score / pdf / etc.) catches a 429 from a provider, ALL
 * other workers for that provider should pause too — Gemini's RPM cap is
 * project-scoped, not connection-scoped, so siblings are about to trip the
 * same limit. Workers `await barrier.acquire()` before each LLM call;
 * acquire() returns immediately when not rate-limited and waits otherwise.
 *
 * Mirrors ArxivDownloadThrottle.rateLimited() shape so the worker-pool
 * barrierFor opt-in can plug either kind of barrier in.
 */
export class LLMRateLimitBarrier {
  constructor() {
    this.pausedUntil = 0;
  }

  async acquire(abortSignal = null) {
    // Loop, re-reading pausedUntil each iteration: another worker may call
    // rateLimited() mid-sleep and extend the window. A single snapshotted
    // sleep would wake too early and hammer the still-rate-limited provider.
    // Optional abortSignal breaks the wait early (pauses run up to 60 s);
    // callers are expected to re-check the signal after acquire resolves.
    while (true) {
      if (abortSignal?.aborted) return;
      const waitMs = this.pausedUntil - Date.now();
      if (waitMs <= 0) break;
      await sleepUnlessAborted(waitMs, abortSignal);
    }
  }

  rateLimited({ retryAfterMs }) {
    const capped = Math.min(Math.max(0, retryAfterMs ?? 0), LLM_MAX_RETRY_AFTER_MS);
    const target = Date.now() + capped;
    if (target > this.pausedUntil) this.pausedUntil = target;
  }

  // Test helper: forcibly clear pause state.
  reset() {
    this.pausedUntil = 0;
  }
}

// Module-level per-provider barriers. Workers across all stages (filter,
// score, rescore, pdf, etc.) share the same barrier per provider, so a
// 429 in any stage pauses every other stage that's hitting that provider.
const _llmBarriers = new Map();
export function getLLMBarrier(provider) {
  const key = (provider ?? 'unknown').toLowerCase();
  let barrier = _llmBarriers.get(key);
  if (!barrier) {
    barrier = new LLMRateLimitBarrier();
    _llmBarriers.set(key, barrier);
  }
  return barrier;
}

// Test helper: clear all barriers between tests.
export function _resetLLMBarriers() {
  _llmBarriers.clear();
}

/**
 * Single-flight gate for the first cacheable call to a provider within a run.
 *
 * AnalysisWorkerPool's `cacheWarmup` already solves this for the common case:
 * worker 0 runs its first task alone so its response primes Anthropic's
 * ephemeral cache entry, and siblings then cache-read instead of racing N
 * parallel cache-creates. But that mechanism gates worker *start*, and it is
 * configured once from the stage's slot model.
 *
 * The refusal `fallback` policy breaks both assumptions: a fallback call
 * happens mid-task (long after workers were released) and may target a
 * different provider than the slot model. So a Google-slot stage falling back
 * to Anthropic gets no warmup at all, and N concurrent fallbacks each pay a
 * cache-create.
 *
 * This gate covers exactly that path. It is deliberately additive rather than
 * a replacement for the pool's warmup: the pool's version is correct for the
 * model it dispatches, well-tested, and on the hot path for every run.
 *
 * Semantics: the first caller for a warming provider runs alone; concurrent
 * callers wait until it settles, then proceed in parallel. The gate opens on
 * settle, not on success — a failed warmer must not deadlock its waiters.
 */
export class CacheWarmupGate {
  constructor() {
    // provider -> { open: boolean, promise: Promise, resolve: () => void }
    this.state = new Map();
  }

  // Providers where a cold parallel burst has a real cost. Anthropic is the
  // only one Aparture sends `cache_control` for — OpenAI auto-caches with no
  // warmup needed, and Google has no prompt caching wired in.
  static WARMING_PROVIDERS = new Set(['anthropic']);

  /**
   * Run `fn` under the gate for `provider`. Non-warming providers pass
   * straight through, so this is safe to call unconditionally.
   */
  async run(provider, fn, abortSignal = null) {
    const key = (provider ?? '').toLowerCase();
    if (!CacheWarmupGate.WARMING_PROVIDERS.has(key)) return fn();

    const existing = this.state.get(key);
    if (!existing) {
      // First caller for this provider: become the warmer.
      const entry = { open: false, promise: null, resolve: null };
      entry.promise = new Promise((r) => {
        entry.resolve = r;
      });
      this.state.set(key, entry);
      try {
        return await fn();
      } finally {
        // `finally`, not the success path: if the warming call throws, the
        // waiters must still be released.
        entry.open = true;
        entry.resolve();
      }
    }

    if (!existing.open) {
      await raceAbort(existing.promise, abortSignal);
    }
    return fn();
  }

  // Cleared at run start — the ephemeral cache entry the warmup primes has a
  // ~5 minute TTL, so a later run needs to warm again rather than inheriting
  // an open gate from a previous one.
  reset() {
    this.state.clear();
  }
}

// Resolve when `promise` settles or `abortSignal` fires, whichever is first.
// Never rejects: callers re-check the abort signal themselves.
function raceAbort(promise, abortSignal) {
  if (!abortSignal) return promise.catch(() => {});
  if (abortSignal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    promise.then(finish, finish);
    abortSignal.addEventListener('abort', finish, { once: true });
  });
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
  constructor({
    concurrency = 3,
    cacheWarmup = false,
    abortSignal = null,
    // Optional `(task) => barrier | null` callback. When set, each worker
    // awaits the returned barrier's acquire() before invoking workerFn.
    // Used by LLM stages to share the per-provider LLMRateLimitBarrier so
    // a 429 in any worker pauses all siblings.
    barrierFor = null,
  } = {}) {
    this.concurrency = Math.max(1, Math.min(20, concurrency));
    this.cacheWarmup = cacheWarmup;
    this.abortSignal = abortSignal;
    this.barrierFor = barrierFor;
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
        // Optional barrier acquire — used by LLM stages to coordinate on
        // rate-limit pauses. No-op when barrierFor is null or returns null.
        if (this.barrierFor) {
          const barrier = this.barrierFor(tasks[idx]);
          if (barrier && typeof barrier.acquire === 'function') {
            // Pass the pool's abort signal so a long rate-limit pause can be
            // broken early; the aborted check below still gates dispatch.
            await barrier.acquire(this.abortSignal);
            if (this.abortSignal?.aborted) break;
          }
        }
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
