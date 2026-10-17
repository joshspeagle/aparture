// Shared per-pipeline closure helpers: token-usage recording, pause/resume
// waiting, and the robust (retry + correction) API-call wrappers. Created
// once per createAnalysisPipeline call so abort/pause semantics stay
// single-instance, then passed to every stage factory via the deps object.
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.
//
// Abort: every helper takes the RUN's AbortSignal explicitly (startProcessing
// captures it once per run and threads it through the stages). The
// abortControllerRef fallback exists only for callers outside a run (the
// dry-run MockAPITester); re-reading the ref mid-run is exactly what let a
// stopped run pick up the next run's live signal and keep billing.

import { CacheWarmupGate, getLLMBarrier } from '../rateLimit.js';
import { RateLimitError } from '../RateLimitError.js';
import { isContentRefusal } from '../ContentRefusalError.js';
import { abortError, abortableDelay, isAbortError, throwIfAborted } from '../../abort.js';
import { providerKeyForModel } from './support.js';

export function createPipelineCore({ store, abortControllerRef, pauseRef }) {
  // Resolve the signal a helper call is bound to: the run's own signal when
  // the caller passes one (always, from the stages), else whatever the ref
  // holds right now (out-of-run callers only).
  const resolveSignal = (signal) => signal ?? abortControllerRef.current?.signal;

  // Per-pipeline, reset at run start. Only the refusal-fallback leg uses it —
  // see the CacheWarmupGate docblock for why the pool's own cacheWarmup
  // doesn't cover that path.
  const warmupGate = new CacheWarmupGate();
  // Record one route response's token usage against a pipeline stage.
  // Routes sum tokensIn/tokensOut/cacheReadTok across their internal provider
  // calls and return them on the 200 body; mock (dry-run) responses carry no
  // usage fields, so dry runs accumulate nothing and the cost UI stays hidden.
  const recordUsage = (stage, model, data) => {
    if (typeof data?.tokensIn !== 'number' && typeof data?.tokensOut !== 'number') return;
    store().addStageUsage(stage, model, {
      tokensIn: data.tokensIn ?? 0,
      tokensOut: data.tokensOut ?? 0,
      cacheReadTok: data.cacheReadTok ?? 0,
    });
  };

  // Resolves when the user resumes (pauseRef cleared), rejects with the abort
  // shape when `signal` (the run's) fires — immediately via the abort event,
  // not on the next 100 ms poll.
  const waitForResume = (signal) => {
    const runSignal = resolveSignal(signal);
    return new Promise((resolve, reject) => {
      const listens = typeof runSignal?.addEventListener === 'function';
      const finish = (err) => {
        clearInterval(checkPause);
        if (listens) runSignal.removeEventListener('abort', onAbort);
        if (err) reject(err);
        else resolve();
      };
      const onAbort = () => finish(abortError());
      const checkPause = setInterval(() => {
        if (runSignal?.aborted) {
          finish(abortError());
          return;
        }
        if (!pauseRef.current) finish();
      }, 100);
      if (runSignal?.aborted) {
        finish(abortError());
        return;
      }
      if (listens) runSignal.addEventListener('abort', onAbort, { once: true });
    });
  };

  // `options.signal` is the run's AbortSignal, captured ONCE here and used for
  // every check, sleep, barrier and gate below — see the module note.
  const makeRobustAPICall = async (
    apiCallFunction,
    parseFunction,
    context = '',
    originalPromptInfo = '',
    { signal } = {}
  ) => {
    const runSignal = resolveSignal(signal);
    const { addStatus } = store();
    const { config } = store().reactContext;
    let lastError = null;
    // Set once, when config.refusalPolicy is 'fallback' and the primary model
    // has already been refused. Threaded into apiCallFunction as a third
    // argument so the retry re-issues against config.refusalFallbackModel;
    // stages that don't support the override simply ignore it.
    let modelOverride = null;

    for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
      try {
        // Check for abort before each retry
        throwIfAborted(runSignal);
        if (pauseRef.current) {
          await waitForResume(runSignal);
        }

        // A fallback attempt may be the first call this run to a provider the
        // stage's worker pool never warmed (its cacheWarmup is derived from
        // the slot model). Gate it so N concurrent fallbacks don't each pay a
        // cache-create. Non-warming providers pass straight through, and the
        // normal path is untouched.
        let responseText = modelOverride
          ? await warmupGate.run(
              providerKeyForModel(modelOverride),
              () => apiCallFunction(undefined, false, modelOverride),
              runSignal
            )
          : await apiCallFunction(undefined, false, modelOverride);
        throwIfAborted(runSignal);

        try {
          const result = parseFunction(responseText);
          return result;
        } catch (parseError) {
          lastError = parseError;
          addStatus(`${context} - Initial parse failed: ${parseError.message}`);
        }

        for (let correctionCount = 1; correctionCount <= config.maxCorrections; correctionCount++) {
          try {
            // Check for abort before each correction
            throwIfAborted(runSignal);
            if (pauseRef.current) {
              await waitForResume(runSignal);
            }

            addStatus(
              `${context} - Frontend correction attempt ${correctionCount}/${config.maxCorrections} (backend already attempted validation)`
            );

            const correctionPrompt = `The response still has issues after backend validation. Please provide a properly formatted response.

  Previous response:
  ${responseText}

  Error: ${lastError.message}

  ${originalPromptInfo ? `Original task: ${originalPromptInfo}` : ''}

  Your entire response MUST ONLY be a single, valid JSON object/array. DO NOT respond with anything other than valid JSON.`;

            responseText = await apiCallFunction(correctionPrompt, true, modelOverride);
            throwIfAborted(runSignal);

            const result = parseFunction(responseText);
            addStatus(`${context} - Correction ${correctionCount} succeeded`);
            return result;
          } catch (correctionError) {
            if (isAbortError(correctionError) || runSignal?.aborted) {
              throw abortError();
            }
            lastError = correctionError;
            addStatus(
              `${context} - Correction ${correctionCount} failed: ${correctionError.message}`
            );
          }
        }

        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - All corrections failed, attempting full retry ${retryCount + 1}/${config.maxRetries}`
          );
        } else {
          throw new Error(
            `All retries and corrections exhausted. Last error: ${lastError?.message || 'Unknown error'}`
          );
        }
      } catch (apiError) {
        // fetch() rejects an aborted request with a DOMException('AbortError'),
        // not the pipeline's 'Operation aborted' — normalize both so stage
        // catches re-throw instead of recording a failure, and never spend a
        // retry (or a status line) on a stopped run.
        if (isAbortError(apiError) || runSignal?.aborted) {
          throw abortError();
        }
        // Playwright-unavailable is a deterministic infrastructure gap — the
        // next retry would hit the same 422. Short-circuit immediately so
        // the per-paper analyzePDFs catch can aggregate it without waiting
        // for retry backoff.
        if (apiError?.code === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA') {
          throw apiError;
        }

        // Content refusal: a safety classifier declined. Deterministic — the
        // same prompt to the same classifier returns the same refusal — so
        // the retry ladder is pure waste, and every wasted attempt still
        // bills input tokens. Short-circuit, optionally re-issuing once
        // against a fallback model, then hand the error to the stage to
        // apply the skip-vs-fail half of config.refusalPolicy.
        if (isContentRefusal(apiError)) {
          const policy = config.refusalPolicy ?? 'skip';
          const fallbackModel = config.refusalFallbackModel;

          if (policy === 'fallback' && fallbackModel && !modelOverride) {
            modelOverride = fallbackModel;
            addStatus(
              `${context} - ${apiError.provider ?? 'provider'} declined (${apiError.category ?? 'unknown'}); retrying on fallback model ${fallbackModel}`
            );
            lastError = apiError;
            // The worker pool acquired the *slot* model's provider barrier
            // before calling us. A cross-provider fallback is about to hit a
            // different provider, so acquire that one too rather than firing
            // at a provider we may already know is rate-limited. (The 429
            // signal path is already provider-correct — it reads
            // apiError.provider — so only the acquire needed fixing.)
            const fallbackProvider = providerKeyForModel(fallbackModel);
            if (fallbackProvider !== providerKeyForModel(apiError.model ?? '')) {
              await getLLMBarrier(fallbackProvider).acquire(runSignal);
              throwIfAborted(runSignal);
            }
            // Re-enter the loop immediately: no backoff (this is not a
            // transient failure) and no retry-budget spend. The one extra
            // attempt is guarded by the !modelOverride check above, so a
            // fallback that also refuses falls through to the policy branch
            // below rather than looping.
            retryCount -= 1;
            continue;
          }

          // 'fail' halts the run; 'skip' (the default) and an exhausted
          // fallback let the stage aggregate and carry on. The flag rides on
          // the error because stage catches otherwise swallow failures to
          // keep the run alive — they check it to know when to re-throw.
          apiError.refusalFatal = policy === 'fail';
          throw apiError;
        }

        // Rate-limit cascade: signal the per-provider barrier so siblings
        // pause too. Gemini's RPM cap is project-scoped — when one worker
        // trips it, the others are about to trip the same limit.
        if (apiError instanceof RateLimitError) {
          const fallbackMs = apiError.retryAfterMs ?? 5000;
          getLLMBarrier(apiError.provider).rateLimited({ retryAfterMs: fallbackMs });
        }

        lastError = apiError;
        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - API call failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`
          );

          // Backoff: prefer provider's Retry-After (cap 60s); else
          // exponential 1s/2s/4s/... capped 30s with ±20% jitter.
          // `!= null` so a provider-signaled 0ms (Retry-After: 0) is honored
          // rather than falling through to exponential delay.
          let delay;
          if (apiError instanceof RateLimitError && apiError.retryAfterMs != null) {
            delay = Math.min(60000, apiError.retryAfterMs);
          } else {
            const base = Math.min(30000, 1000 * Math.pow(2, retryCount));
            const jitter = base * (0.8 + 0.4 * Math.random());
            delay = Math.round(jitter);
          }

          // Sleep with abort checking (rejects the moment the run is stopped)
          await abortableDelay(delay, runSignal);
        } else {
          throw apiError;
        }
      }
    }

    throw lastError;
  };

  const makeMockRobustAPICall = async (
    mockApiFunction,
    parseFunction,
    context = '',
    { signal } = {}
  ) => {
    const runSignal = resolveSignal(signal);
    const { addStatus } = store();
    const { config } = store().reactContext;
    let lastError = null;

    for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
      try {
        // Check for abort before each retry
        throwIfAborted(runSignal);
        if (pauseRef.current) {
          await waitForResume(runSignal);
        }

        let responseText = await mockApiFunction();
        // The MockAPITester polls the shared ref, which a newer run may
        // already own — re-check this run's own signal after every call.
        throwIfAborted(runSignal);

        try {
          const result = parseFunction(responseText);
          return result;
        } catch (parseError) {
          lastError = parseError;
          addStatus(`${context} - Mock parse failed: ${parseError.message}`);
        }

        for (let correctionCount = 1; correctionCount <= config.maxCorrections; correctionCount++) {
          try {
            // Check for abort before each correction
            throwIfAborted(runSignal);
            if (pauseRef.current) {
              await waitForResume(runSignal);
            }

            addStatus(`${context} - Mock correction ${correctionCount}/${config.maxCorrections}`);
            responseText = await mockApiFunction(true); // Pass isCorrection = true
            throwIfAborted(runSignal);
            const result = parseFunction(responseText);
            addStatus(`${context} - Mock correction ${correctionCount} succeeded`);
            return result;
          } catch (correctionError) {
            if (isAbortError(correctionError) || runSignal?.aborted) {
              throw abortError();
            }
            lastError = correctionError;
            addStatus(
              `${context} - Mock correction ${correctionCount} failed: ${correctionError.message}`
            );
          }
        }

        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - Mock corrections failed, retry ${retryCount + 1}/${config.maxRetries}`
          );
        } else {
          throw new Error(
            `Mock retries exhausted. Last error: ${lastError?.message || 'Unknown error'}`
          );
        }
      } catch (apiError) {
        if (isAbortError(apiError) || runSignal?.aborted) {
          throw abortError();
        }
        // Playwright-unavailable is an infrastructure gap that won't fix
        // itself on retry; propagate immediately for the caller to aggregate.
        if (apiError?.code === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA') {
          throw apiError;
        }
        lastError = apiError;
        if (retryCount < config.maxRetries) {
          addStatus(
            `${context} - Mock API failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`
          );

          // Sleep with abort checking
          await abortableDelay(500, runSignal);
        } else {
          throw apiError;
        }
      }
    }

    throw lastError;
  };

  const resetWarmupGate = () => warmupGate.reset();

  return {
    recordUsage,
    waitForResume,
    makeRobustAPICall,
    makeMockRobustAPICall,
    resetWarmupGate,
  };
}
