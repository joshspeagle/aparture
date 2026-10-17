// Abort helpers shared by the analysis pipeline (lib/analyzer) and the arXiv
// drivers (lib/arxiv).
//
// Every pipeline run owns ONE AbortController, created in startProcessing.
// Its signal is captured once per run and threaded explicitly into every
// stage, worker pool, fetch and sleep. It is never re-read from
// abortControllerRef at use time: a Stop→Start replaces the ref, so a stopped
// run that re-read it would pick up the NEW run's live signal and keep going
// as a zombie (billing a second pipeline and saving a second briefing).
//
// The pipeline's canonical abort shape is `new Error('Operation aborted')`.
// fetch() rejects with a DOMException named 'AbortError' instead, so
// isAbortError() recognizes both.

export const ABORT_MESSAGE = 'Operation aborted';

export function abortError() {
  return new Error(ABORT_MESSAGE);
}

export function isAbortError(error) {
  return error?.message === ABORT_MESSAGE || error?.name === 'AbortError';
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

// Only a real AbortSignal may be handed to fetch(): the duck-typed
// `{aborted: boolean}` stand-ins some tests use are not assignable to
// RequestInit.signal and would throw a TypeError.
export function fetchSignalFor(signal) {
  return typeof globalThis.AbortSignal !== 'undefined' && signal instanceof globalThis.AbortSignal
    ? signal
    : undefined;
}

// Settles like `promise`, except that it rejects with the abort shape as soon
// as `signal` fires. The wrapped work itself is not cancelled — this exists
// for injectable sleeps (`sleepImpl(ms)`) whose implementation the caller
// doesn't control, so a long backoff (arXiv waits up to 60 s) never outlives
// a Stop click. Duck-typed `{aborted}` stand-ins are polled instead.
export function untilAborted(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    Promise.resolve(promise).catch(() => {});
    return Promise.reject(abortError());
  }
  return new Promise((resolve, reject) => {
    let poll = null;
    const listens = typeof signal.addEventListener === 'function';
    const cleanup = () => {
      if (poll) clearInterval(poll);
      if (listens) signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    if (listens) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      poll = setInterval(() => {
        if (signal.aborted) onAbort();
      }, 50);
    }
    Promise.resolve(promise).then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (err) => {
        cleanup();
        reject(err);
      }
    );
  });
}

// Sleep that rejects with the abort shape as soon as `signal` fires (and
// clears its timer). Duck-typed `{aborted}` stand-ins without
// addEventListener are polled instead.
export function abortableDelay(ms, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let poll = null;
    const listens = typeof signal?.addEventListener === 'function';
    const cleanup = () => {
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      if (listens) signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const timer = setTimeout(
      () => {
        cleanup();
        resolve();
      },
      Math.max(0, ms)
    );
    if (listens) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else if (signal) {
      poll = setInterval(() => {
        if (signal.aborted) onAbort();
      }, 50);
    }
  });
}
