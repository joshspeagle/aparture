// Stage 4: deep PDF analysis of the selected top papers.
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.
// Reads all state from store()/store().reactContext at call time.

import { AnalysisWorkerPool, getLLMBarrier } from '../rateLimit.js';
import {
  NonRetryableRouteError,
  RateLimitError,
  isNonRetryableError,
  parseRouteError,
} from '../RateLimitError.js';
import { ContentRefusalError, isContentRefusal, RefusalHaltError } from '../ContentRefusalError.js';
import { abortError, isAbortError, throwIfAborted } from '../../abort.js';
import { extractJsonFromLlmOutput } from '../../../utils/json.js';
import { providerKeyForModel } from './support.js';
import { profileWithNotes } from '../../profile/editorialNotes.js';

export function createAnalyzePDFs(deps) {
  const {
    store,
    abortControllerRef,
    pauseRef,
    mockAPITesterRef,
    waitForResume,
    recordUsage,
    makeRobustAPICall,
    makeMockRobustAPICall,
  } = deps;

  // `signal` is the run's AbortSignal, captured once (see quickFilter.js).
  const analyzePDFs = async (papers, isDryRun = false, { signal } = {}) => {
    const runSignal = signal ?? abortControllerRef.current?.signal;
    const { addError, password, setProcessing, setResults } = store();
    const { config, profile } = store().reactContext;
    setProcessing((prev) => ({
      ...prev,
      stage: 'deep-analysis',
      progress: { current: 0, total: papers.length },
    }));

    // Pre-allocate so worker completions can write by index and preserve the
    // input ordering (workers claim in order but may complete out of order).
    const analyzedPapers = new Array(papers.length);
    let completedCount = 0;

    // Stage 3 parallelism knob. Dry-run runs single-threaded (mock path is
    // instant and visual pacing matters). Live runs fan out to N workers.
    // See docs/superpowers/specs/2026-04-17-pdf-parallelism-design.md.
    const concurrency = isDryRun
      ? 1
      : Math.max(1, Math.min(20, config.pdfAnalysisConcurrency ?? 3));

    // Cache-warmup barrier — Anthropic-only. The first worker runs solo so
    // its response primes the ephemeral prompt-cache entry; sibling workers
    // then start and hit the cache instead of racing parallel creates.
    // Revisit if adding a new provider with single-flight prefix semantics
    // (OpenAI currently auto-caches with no warmup needed, Google has no
    // caching). See spec §3.2 "Revisit if" for triggers.
    const providerLower = providerKeyForModel(config.pdfModel);
    const shouldWarmupCache = !isDryRun && providerLower === 'anthropic';

    const pool = new AnalysisWorkerPool({
      concurrency,
      cacheWarmup: shouldWarmupCache,
      abortSignal: runSignal,
      barrierFor: !isDryRun ? () => getLLMBarrier(providerLower) : null,
    });

    let rateLimitedPapers = 0;

    const runSingle = async (paper, idx) => {
      throwIfAborted(runSignal);
      if (pauseRef.current) await waitForResume(runSignal);

      try {
        let analysis;

        if (isDryRun) {
          const mockApiCall = async (isCorrection = false) => {
            return await mockAPITesterRef.current.mockAnalyzePDF(paper, isCorrection);
          };

          const parseResponse = (responseText) => {
            const cleanedText = extractJsonFromLlmOutput(responseText);
            const parsed = JSON.parse(cleanedText);

            if (!parsed.summary || typeof parsed.updatedScore === 'undefined') {
              throw new Error(
                'Missing required fields (summary or updatedScore) in analysis response'
              );
            }
            if (typeof parsed.summary !== 'string') {
              throw new Error('Summary field must be a string');
            }
            if (typeof parsed.updatedScore !== 'number') {
              throw new Error('UpdatedScore field must be a number');
            }
            if (parsed.updatedScore < 0 || parsed.updatedScore > 10) {
              throw new Error(
                `UpdatedScore must be between 0.0 and 10.0, got ${parsed.updatedScore}`
              );
            }
            parsed.updatedScore = Math.round(parsed.updatedScore * 10) / 10;
            return parsed;
          };

          analysis = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock analyzing paper "${paper.title}"`,
            { signal: runSignal }
          );
        } else {
          // modelOverride is supplied by makeRobustAPICall only when the
          // refusal 'fallback' policy re-issues a declined call; null on
          // every normal call, so the configured slot model is used.
          const makeAPICall = async (
            correctionPrompt = null,
            isCorrection = false,
            modelOverride = null
          ) => {
            const effectiveModel = modelOverride ?? config.pdfModel;
            const requestBody = {
              pdfUrl: paper.pdfUrl,
              arxivId: paper.arxivId ?? paper.id,
              title: paper.title,
              scoringCriteria: profileWithNotes(profile.content, profile.notes, 'selection'),
              originalScore: paper.relevanceScore,
              password: password,
              model: effectiveModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/analyze-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: runSignal,
            });

            if (!response.ok) {
              // This route has two distinct 422s — PLAYWRIGHT_UNAVAILABLE_RECAPTCHA
              // and CONTENT_REFUSAL — and both need skip-and-continue rather
              // than a retry. The body can only be read once, so dispatch on
              // it here instead of delegating to parseRouteError (which would
              // otherwise be the one place that types a CONTENT_REFUSAL).
              if (response.status === 422) {
                const errorData = await response.json().catch(() => ({}));
                if (errorData?.error === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA') {
                  const skipErr = new Error('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA');
                  skipErr.code = 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA';
                  skipErr.arxivId = errorData.arxivId ?? paper.arxivId ?? paper.id;
                  skipErr.title = errorData.title ?? paper.title;
                  throw skipErr;
                }
                if (errorData?.code === 'CONTENT_REFUSAL') {
                  throw new ContentRefusalError({
                    provider: errorData.provider ?? providerLower,
                    model: errorData.model ?? null,
                    category: errorData.category ?? null,
                    raw: errorData.raw ?? null,
                    details: errorData.details ?? null,
                    message: errorData.error,
                  });
                }
                // Any other 422 is deterministic too — fail fast.
                throw new NonRetryableRouteError({
                  provider: errorData.provider ?? providerLower,
                  status: 422,
                  message: errorData.details || errorData.error || `API error: ${response.status}`,
                });
              }
              await parseRouteError(response, providerLower);
            }

            const data = await response.json();
            recordUsage('pdf', effectiveModel, data);
            if (data.analysis && typeof data.analysis === 'object') {
              return JSON.stringify(data.analysis);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = extractJsonFromLlmOutput(responseText);
            const parsed = JSON.parse(cleanedText);

            if (!parsed.summary || typeof parsed.updatedScore === 'undefined') {
              throw new Error(
                'Missing required fields (summary or updatedScore) in analysis response'
              );
            }
            if (typeof parsed.summary !== 'string') {
              throw new Error('Summary field must be a string');
            }
            if (typeof parsed.updatedScore !== 'number') {
              throw new Error('UpdatedScore field must be a number');
            }
            if (parsed.updatedScore < 0 || parsed.updatedScore > 10) {
              throw new Error(
                `UpdatedScore must be between 0.0 and 10.0, got ${parsed.updatedScore}`
              );
            }
            parsed.updatedScore = Math.round(parsed.updatedScore * 10) / 10;
            return parsed;
          };

          analysis = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Analyzing paper "${paper.title}"`,
            `Analyze PDF content and provide updated relevance score with detailed summary`,
            { signal: runSignal }
          );
        }

        const preAnalysisScore = paper.relevanceScore ?? paper.initialScore ?? 0;
        const pdfScoreAdjustment = analysis.updatedScore - preAnalysisScore;
        const analyzedPaper = {
          ...paper,
          deepAnalysis: analysis,
          finalScore: analysis.updatedScore,
          preAnalysisScore,
          pdfScoreAdjustment,
        };
        analyzedPapers[idx] = analyzedPaper;

        completedCount += 1;
        setProcessing((prev) => ({
          ...prev,
          progress: { current: completedCount, total: papers.length },
        }));

        setResults((prev) => {
          const updatedRanking = [...prev.finalRanking];
          const paperIndex = updatedRanking.findIndex((p) => p.id === paper.id);
          if (paperIndex !== -1) {
            updatedRanking[paperIndex] = analyzedPaper;
          }
          updatedRanking.sort((a, b) => {
            const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
            const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
            return scoreB - scoreA;
          });
          return { ...prev, finalRanking: updatedRanking };
        });

        if (isDryRun) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        // A stopped run: re-throw so the pool halts, rather than recording
        // "Failed to analyze paper … after all retries: Operation aborted"
        // for every in-flight paper.
        if (isAbortError(error) || runSignal?.aborted) {
          throw abortError();
        }
        // Playwright-unavailable: aggregate into the dedicated skip slice,
        // keep the paper in results with a skip-reason marker, and continue.
        // `makeRobustAPICall` wraps the sentinel error after maxRetries, so
        // detect the code via the direct error or its message substring.
        const isPlaywrightSkip =
          error?.code === 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA' ||
          (typeof error?.message === 'string' &&
            error.message.includes('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA'));

        // A safety-classifier refusal is recorded under every policy, so the
        // RefusalSummaryCard can explain it. Under 'skip' (and an exhausted
        // 'fallback') the paper is then skipped the same way as the
        // Playwright case: it can't be deep-analysed, but the other 19 in
        // the run still can. Under 'fail' (refusalFatal) the run halts.
        const isRefusal = isContentRefusal(error);
        if (isRefusal) {
          store().addRefusal({
            stage: 'pdf',
            scope: paper.title,
            provider: error.provider,
            model: error.model,
            category: error.category,
            raw: error.raw,
          });
          if (error.refusalFatal) {
            throw new RefusalHaltError({ refusal: error, stage: 'pdf', scope: paper.title });
          }
        }

        if (isPlaywrightSkip || isRefusal) {
          const { addSkippedDueToRecaptcha, addStatus } = store();
          if (isPlaywrightSkip) {
            addStatus(
              `Skipping "${paper.title}" (${paper.arxivId ?? paper.id}): Playwright unavailable for reCAPTCHA bypass`
            );
            addSkippedDueToRecaptcha({
              id: paper.id,
              arxivId: paper.arxivId ?? paper.id,
              title: paper.title,
            });
          } else {
            addStatus(
              `Skipping "${paper.title}" (${paper.arxivId ?? paper.id}): ${error.provider ?? 'provider'} declined (${error.category ?? 'unknown'})`
            );
          }
          const skippedPaper = {
            ...paper,
            deepAnalysis: null,
            finalScore: paper.relevanceScore || 0,
            pdfAnalysisSkipReason: isPlaywrightSkip ? 'recaptcha-no-playwright' : 'content-refusal',
          };
          analyzedPapers[idx] = skippedPaper;

          completedCount += 1;
          setProcessing((prev) => ({
            ...prev,
            progress: { current: completedCount, total: papers.length },
          }));
          setResults((prev) => {
            const updatedRanking = [...prev.finalRanking];
            const paperIndex = updatedRanking.findIndex((p) => p.id === paper.id);
            if (paperIndex !== -1) {
              updatedRanking[paperIndex] = skippedPaper;
            }
            updatedRanking.sort((a, b) => {
              const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
              const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
              return scoreB - scoreA;
            });
            return { ...prev, finalRanking: updatedRanking };
          });
          return;
        }

        if (error instanceof RateLimitError) rateLimitedPapers += 1;
        const after = isNonRetryableError(error) ? '' : ' after all retries';
        addError(`Failed to analyze paper "${paper.title}"${after}: ${error.message}`);
        analyzedPapers[idx] = {
          ...paper,
          deepAnalysis: null,
          finalScore: paper.relevanceScore || 0,
        };
        completedCount += 1;
        setProcessing((prev) => ({
          ...prev,
          progress: { current: completedCount, total: papers.length },
        }));
      }
    };

    await pool.run(papers, runSingle);
    throwIfAborted(runSignal);

    // Filter holes in case abort left unclaimed papers undefined.
    const finalPapers = analyzedPapers.filter((p) => p !== undefined);
    const succeeded = finalPapers.filter((p) => p?.deepAnalysis).length;
    const rlSuffix = rateLimitedPapers > 0 ? `, ${rateLimitedPapers} rate-limited` : '';
    store().addStatus(
      `PDF analysis complete: ${succeeded}/${papers.length} papers analyzed${rlSuffix}`
    );
    return finalPapers;
  };

  return analyzePDFs;
}
