// Shared per-pipeline closure helpers: token-usage recording, pause/resume
// waiting, and the robust (retry + correction) API-call wrappers. Created
// once per createAnalysisPipeline call so abort/pause semantics stay
// single-instance, then passed to every stage factory via the deps object.
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.

import { getLLMBarrier } from '../rateLimit.js';
import { RateLimitError } from '../RateLimitError.js';
import { isContentRefusal } from '../ContentRefusalError.js';
import { providerKeyForModel } from './support.js';

export function createPipelineCore({ store, abortControllerRef, pauseRef }) {
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

  const waitForResume = () => {
    return new Promise((resolve, reject) => {
      const checkPause = setInterval(() => {
        if (abortControllerRef.current?.signal.aborted) {
          clearInterval(checkPause);
          reject(new Error('Operation aborted'));
          return;
        }
        if (!pauseRef.current) {
          clearInterval(checkPause);
          resolve();
        }
      }, 100);
    });
  };

  const makeRobustAPICall = async (
    apiCallFunction,
    parseFunction,
    context = '',
    originalPromptInfo = ''
  ) => {
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
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }
        if (pauseRef.current) {
          await waitForResume();
        }

        let responseText = await apiCallFunction(undefined, false, modelOverride);

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
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            if (pauseRef.current) {
              await waitForResume();
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

            const result = parseFunction(responseText);
            addStatus(`${context} - Correction ${correctionCount} succeeded`);
            return result;
          } catch (correctionError) {
            if (correctionError.message === 'Operation aborted') {
              throw correctionError;
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
        if (apiError.message === 'Operation aborted') {
          throw apiError;
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
              await getLLMBarrier(fallbackProvider).acquire(abortControllerRef.current?.signal);
              if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
              }
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

          // Sleep with abort checking
          for (let i = 0; i < delay; i += 50) {
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } else {
          throw apiError;
        }
      }
    }

    throw lastError;
  };

  const makeMockRobustAPICall = async (mockApiFunction, parseFunction, context = '') => {
    const { addStatus } = store();
    const { config } = store().reactContext;
    let lastError = null;

    for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
      try {
        // Check for abort before each retry
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }
        if (pauseRef.current) {
          await waitForResume();
        }

        let responseText = await mockApiFunction();

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
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            if (pauseRef.current) {
              await waitForResume();
            }

            addStatus(`${context} - Mock correction ${correctionCount}/${config.maxCorrections}`);
            responseText = await mockApiFunction(true); // Pass isCorrection = true
            const result = parseFunction(responseText);
            addStatus(`${context} - Mock correction ${correctionCount} succeeded`);
            return result;
          } catch (correctionError) {
            if (correctionError.message === 'Operation aborted') {
              throw correctionError;
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
        if (apiError.message === 'Operation aborted') {
          throw apiError;
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
          const delay = 500;
          for (let i = 0; i < delay; i += 50) {
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('Operation aborted');
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } else {
          throw apiError;
        }
      }
    }

    throw lastError;
  };

  return { recordUsage, waitForResume, makeRobustAPICall, makeMockRobustAPICall };
}
