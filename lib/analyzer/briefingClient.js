// Client-side briefing generation orchestrator.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F4a).
//
// Owns the full flow: map papers → quick-summary fan-out → synthesize →
// hallucination check → optional retry → persist via saveBriefing.
// All React state updates go through injected setters; the module itself
// has no React imports and is unit-testable in isolation.

import { DEFAULT_MODEL_ID, MODEL_REGISTRY } from '../../utils/models.js';
import { localDateStr } from '../dates.js';
import { composeFullReport } from './composeFullReport.js';
import { parseRouteError, RateLimitError } from './RateLimitError.js';
import { AnalysisWorkerPool, getLLMBarrier } from './rateLimit.js';

const LAST_RUN_CACHE_KEY = 'aparture-last-analysis-run';

function resolveProvider(modelId) {
  const modelCfg = MODEL_REGISTRY[modelId];
  const rawProvider = modelCfg?.provider ?? 'Google';
  return rawProvider.toLowerCase();
}

function mapFinalRankingToBriefingPapers(finalRanking, feedbackEvents = []) {
  // Build a per-paper engagement index from feedback events.
  // Stars and dismissals use latest-wins; comments are append-only.
  const engagementByPaper = new Map();
  for (const e of feedbackEvents) {
    if (!e.arxivId) continue;
    const entry = engagementByPaper.get(e.arxivId) ?? {
      starred: false,
      dismissed: false,
      comments: [],
    };
    if (e.type === 'star') {
      entry.starred = true;
      entry.dismissed = false;
    }
    if (e.type === 'dismiss') {
      entry.dismissed = true;
      entry.starred = false;
    }
    if (e.type === 'paper-comment' && e.comment) {
      entry.comments.push(e.comment);
    }
    engagementByPaper.set(e.arxivId, entry);
  }

  return finalRanking.map((p) => {
    const arxivId = p.arxivId ?? p.id;
    const paper = {
      arxivId,
      title: p.title,
      abstract: p.abstract ?? '',
      score: p.score ?? p.finalScore ?? 0,
      scoringJustification:
        p.scoreJustification ?? p.justification ?? p.deepAnalysis?.relevanceAssessment ?? '',
      fullReport: composeFullReport(p),
    };
    const engagement = engagementByPaper.get(arxivId);
    if (engagement) {
      paper.engagement = {
        starred: engagement.starred,
        dismissed: engagement.dismissed,
        ...(engagement.comments.length > 0 ? { comments: engagement.comments } : {}),
      };
    }
    return paper;
  });
}

// Generate per-paper quick summaries via an N-wide worker pool. Returns a
// map keyed by arxivId. Failures on individual papers are non-fatal — the
// batch completes and the briefing still runs, just with fewer inline
// expansions — but each paper gets one retry (429/503 honor the provider's
// Retry-After via the shared per-provider barrier) and any remaining
// failures are surfaced as an "N/M quick summaries failed" status line
// instead of being silently swallowed. The pool keeps all N lanes busy (no
// straggler serialization at chunk boundaries) and stops dispatching when
// abortSignal fires. Exported for direct unit testing.
export async function generateQuickSummaries({
  papers,
  provider,
  modelId,
  password,
  concurrency,
  abortSignal,
  addStatus = () => {},
  // Optional (stage, model, {tokensIn, tokensOut, cacheReadTok}) callback for
  // per-stage cost accumulation. Never called on the mock (dry-run) path.
  onUsage = () => {},
  mockTester = null,
}) {
  const quickById = {};
  const papersWithReports = papers.filter((p) => p.fullReport);
  let failedCount = 0;

  // Dry-run path: fully mocked — no fetch, no retry ladder, no shared
  // rate-limit barrier. Sequential is fine because mock latency is tens of
  // milliseconds; abort/pause handling lives inside the mock itself.
  if (mockTester) {
    for (const p of papersWithReports) {
      if (abortSignal?.aborted) return quickById;
      quickById[p.arxivId] = await mockTester.mockQuickSummary(p);
    }
    return quickById;
  }

  const requestSummary = async (p) => {
    const res = await fetch('/api/analyze-pdf-quick', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        paper: p,
        fullReport: p.fullReport,
        provider,
        model: modelId,
        password,
      }),
      signal: abortSignal ?? undefined,
    });
    // 429/503 → RateLimitError with retryAfterMs; other non-OK → Error
    // carrying the route's actual details string.
    if (!res.ok) await parseRouteError(res, provider);
    return await res.json();
  };

  // Shared per-provider barrier — the same instance the pipeline stages use
  // via barrierFor, so a 429 here pauses sibling workers (and vice versa)
  // instead of piling onto an already rate-limited provider.
  const barrier = getLLMBarrier(provider);

  // The pool clamps concurrency to 1–20, so a corrupted config can't stall
  // the run or drown the provider in simultaneous requests.
  const pool = new AnalysisWorkerPool({
    concurrency: concurrency ?? 5,
    abortSignal,
    barrierFor: () => barrier,
  });
  await pool.run(papersWithReports, async (p) => {
    try {
      let json;
      try {
        json = await requestSummary(p);
      } catch (err) {
        // Aborted mid-flight: not a failure, and retrying is pointless.
        if (abortSignal?.aborted) return;
        // One retry. Rate limits signal the shared barrier first, then wait
        // out the provider's Retry-After window before re-requesting.
        if (err instanceof RateLimitError) {
          barrier.rateLimited({ retryAfterMs: err.retryAfterMs ?? 5000 });
          await barrier.acquire(abortSignal);
          if (abortSignal?.aborted) return;
        }
        json = await requestSummary(p);
      }
      quickById[p.arxivId] = json.quickSummary;
      onUsage('quickSummary', modelId, json);
    } catch (err) {
      // Non-fatal: a single paper's quick summary failing does not block
      // the rest of the batch or the main synthesis call — but the failure
      // is counted and surfaced below rather than silently swallowed.
      if (abortSignal?.aborted) return;
      failedCount += 1;
      console.warn(`[briefing] Quick summary failed for ${p.arxivId}:`, err?.message ?? err);
    }
  });

  if (failedCount > 0) {
    addStatus(
      `Warning: ${failedCount}/${papersWithReports.length} quick summaries failed — ` +
        `the briefing will run with a reduced grounding corpus`
    );
  }

  return quickById;
}

// The /api/synthesize 502 body for a structured-output miss. Thinking-enabled
// models occasionally emit a text-only response (no tool_use block), which
// the route surfaces with exactly this error string.
const NO_STRUCTURED_OUTPUT_ERROR = 'model did not return structured output';

// Exported for direct unit testing of the no-structured-output retry.
export async function callSynthesize({
  profile,
  papers,
  provider,
  modelId,
  password,
  retryHint = null,
  signal = null,
}) {
  const body = {
    profile,
    papers,
    provider,
    model: modelId,
    password,
  };
  if (retryHint) body.retryHint = retryHint;
  const doFetch = () =>
    fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal ?? undefined,
    });

  let res = await doFetch();

  // One re-attempt when the model returned no structured output — a known
  // intermittent failure mode of thinking-enabled models (tool_choice must be
  // 'auto' when thinking is on, so the tool call cannot be forced). Mirrors
  // the one-shot validation-retry pattern the rubric routes use; without it a
  // single text-only response kills the entire run's briefing after all the
  // per-paper spend.
  if (res.status === 502 && !signal?.aborted) {
    let errBody = {};
    try {
      errBody = await res.json();
    } catch {
      // Non-JSON 502 (proxy HTML etc.) — fall through to the error path below.
    }
    if (errBody?.error === NO_STRUCTURED_OUTPUT_ERROR) {
      console.warn('[briefing] synthesize returned no structured output; retrying once');
      res = await doFetch();
    } else if (!res.ok) {
      // Body already consumed — parseRouteError can't re-read it, so throw
      // the equivalent error here (same message preference: details > error).
      throw new Error(errBody.details || errBody.error || `${provider} request failed (502)`);
    }
  }

  if (!res.ok) {
    // Surfaces actual provider message (e.g. "google: rate limited (429) — retry in 23s")
    // instead of the bare "synthesis failed".
    await parseRouteError(res, provider);
  }
  return await res.json();
}

// Hallucination check is non-fatal: if the route fails we return null so
// the caller falls back to trusting the original briefing. Exported for
// direct unit testing of that non-fatal contract.
export async function callCheckBriefing({
  briefingObj,
  papers,
  quickById,
  provider,
  modelId,
  password,
  signal = null,
}) {
  const corpus = papers.map((p) => ({
    arxivId: p.arxivId,
    title: p.title,
    abstract: p.abstract,
    quickSummary: quickById[p.arxivId] ?? '',
    fullReport: p.fullReport,
  }));
  const res = await fetch('/api/check-briefing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      briefing: briefingObj,
      papers: corpus,
      provider,
      model: modelId,
      password,
    }),
    signal: signal ?? undefined,
  });
  // Parse defensively: a non-JSON proxy error (e.g. a 502/504 HTML body from a
  // gateway) would throw here. The hallucination check is non-fatal by
  // contract, so any parse failure returns null rather than escaping into
  // runBriefingGeneration's catch and failing the whole briefing.
  let json = null;
  try {
    json = await res.json();
  } catch {
    console.warn('[Phase 1.5.1] Hallucination check returned a non-JSON body; treating as skipped');
    return null;
  }
  if (!res.ok) {
    console.warn('[Phase 1.5.1] Hallucination check failed:', json?.error);
    return null;
  }
  return json;
}

function cacheLastAnalysisRun(finalRanking, quickById) {
  try {
    const cachedPapers = finalRanking.map((p) => {
      const arxivId = p.arxivId ?? p.id;
      return {
        arxivId,
        title: p.title,
        abstract: p.abstract ?? '',
        score: p.score ?? p.finalScore ?? 0,
        scoringJustification:
          p.scoreJustification ?? p.justification ?? p.deepAnalysis?.relevanceAssessment ?? '',
        fullReport: composeFullReport(p),
        quickSummary: quickById?.[arxivId] ?? '',
      };
    });
    window.localStorage.setItem(
      LAST_RUN_CACHE_KEY,
      JSON.stringify({ papers: cachedPapers, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn('[Phase 1.5] Failed to cache last analysis run for preview:', e);
  }
}

// Note on value snapshots: config-derived primitives (briefingRetryOnYes,
// briefingRetryOnMaybe, briefingModel, pdfModel) are captured at call time
// and intentionally frozen for the duration of the async flow. Retry
// checkbox toggles made during an in-flight briefing will NOT take effect
// on the current run — that matches the user's mental model ("toggle now
// applies to the next run") and avoids surprise mid-flight behavior.
export async function runBriefingGeneration({
  results,
  briefingModel,
  pdfModel,
  quickSummaryModel,
  quickSummaryConcurrency,
  briefingRetryOnYes = true,
  briefingRetryOnMaybe = false,
  profile,
  password,
  feedbackEvents = [],
  filterResults = null,
  saveBriefing,
  generationMetadata = null,
  setSynthesizing,
  setSynthesisError,
  setBriefingCheckResult,
  setBriefingStage,
  setQuickSummariesById,
  setFullReportsById,
  addStatus = () => {},
  // Optional (stage, model, usage) callback for per-stage cost accumulation.
  // Fires for quick summaries, synthesis, and the hallucination check on
  // live runs only — the mock (dry-run) path reports no usage.
  onUsage = () => {},
  abortSignal = null,
  // Dry-run only: a MockAPITester instance. When present, quick summaries,
  // synthesis, and the hallucination check all use its mock methods instead
  // of fetching the real routes — a dry run must never bill the user (or
  // 401 on a keyless install). The saved briefing flows through the same
  // saveBriefing path so the UI renders it identically.
  mockTester = null,
}) {
  setSynthesizing(true);
  setSynthesisError(null);
  setBriefingCheckResult(null);
  setBriefingStage('synthesizing');
  // Same abort error shape the pipeline uses, checked between phases so a
  // stop click doesn't leave the multi-minute synthesize → check → retry
  // chain running to completion.
  const throwIfAborted = () => {
    if (abortSignal?.aborted) throw new Error('Operation aborted');
  };
  try {
    const finalRanking = results?.finalRanking ?? [];
    if (finalRanking.length === 0) {
      throw new Error('No final-ranking papers available to synthesize.');
    }

    // Falls back to pdfModel for legacy configs that predate briefingModel.
    const modelId = briefingModel ?? pdfModel ?? DEFAULT_MODEL_ID;
    const provider = resolveProvider(modelId);

    // Quick-summary model is independent of the synthesis model — it runs
    // a text-compression task that benefits from being small + cheap. Falls
    // back to briefingModel for legacy configs that predate this slot.
    const quickModelId = quickSummaryModel ?? modelId;
    const quickProvider = resolveProvider(quickModelId);

    const papers = mapFinalRankingToBriefingPapers(finalRanking, feedbackEvents);

    // Populate fullById synchronously (no network calls).
    const fullById = {};
    for (const p of papers) {
      fullById[p.arxivId] = p.fullReport;
    }

    const quickById = await generateQuickSummaries({
      papers,
      provider: quickProvider,
      modelId: quickModelId,
      password,
      concurrency: quickSummaryConcurrency,
      abortSignal,
      addStatus,
      onUsage,
      mockTester,
    });
    throwIfAborted();
    setQuickSummariesById(quickById);
    setFullReportsById(fullById);

    // Dry-run dispatch, consolidated: every synthesize/check call and every
    // usage report below goes through these three closures, so the
    // "mockTester means zero fetches, zero usage" invariant lives in exactly
    // one place instead of five inline ternaries. (Quick summaries keep
    // their own mock branch inside generateQuickSummaries — the live path
    // there is a worker pool, not a single call.) callSynthesize ignores a
    // null retryHint. The check route returns tokensIn/tokensOut too; both
    // synthesis and the check run on the same model, so they accumulate
    // into one briefing stage.
    const doSynthesize = (retryHint = null) =>
      mockTester
        ? mockTester.mockSynthesize(papers)
        : callSynthesize({
            profile: profile.content,
            papers,
            provider,
            modelId,
            password,
            retryHint,
            signal: abortSignal,
          });
    const doCheck = (briefingObj) =>
      mockTester
        ? mockTester.mockCheckBriefing()
        : callCheckBriefing({
            briefingObj,
            papers,
            quickById,
            provider,
            modelId,
            password,
            signal: abortSignal,
          });
    const emitUsage = (json) => {
      if (!mockTester && json) onUsage('briefing', modelId, json);
    };

    // First synthesis pass
    const synthJson = await doSynthesize();
    let finalBriefing = synthJson.briefing;
    let finalCheck = null;
    let retried = false;
    emitUsage(synthJson);

    // Hallucination check + optional retry
    throwIfAborted();
    setBriefingStage('checking');
    finalCheck = await doCheck(finalBriefing);
    emitUsage(finalCheck);

    if (finalCheck) {
      const shouldRetry =
        (finalCheck.verdict === 'YES' && briefingRetryOnYes) ||
        (finalCheck.verdict === 'MAYBE' && briefingRetryOnMaybe);

      if (shouldRetry) {
        throwIfAborted();
        setBriefingStage('retrying');
        const retryHint = `A hallucination check on your previous briefing returned ${finalCheck.verdict}. Reason: ${finalCheck.justification} Ground all claims strictly in the provided source material this time.`;
        try {
          // The mock check always returns a passing verdict so this branch
          // is unreachable on a dry run today, but doSynthesize/doCheck keep
          // the mock guard so the "mockTester means zero fetches" invariant
          // survives future changes to the mock verdict.
          const retryJson = await doSynthesize(retryHint);
          finalBriefing = retryJson.briefing;
          emitUsage(retryJson);
          // Re-run the check on the retry so the badge reflects the final state
          setBriefingStage('checking');
          const recheck = await doCheck(finalBriefing);
          if (recheck) {
            emitUsage(recheck);
            finalCheck = recheck;
          }
          retried = true;
        } catch (retryErr) {
          // An abort is not a retry failure — let the outer catch re-throw it.
          if (abortSignal?.aborted) throw retryErr;
          console.warn('[Phase 1.5.1] Retry synthesis failed, keeping original:', retryErr);
        }
      }
    }

    throwIfAborted();
    setBriefingCheckResult(finalCheck ? { ...finalCheck, retried } : null);
    setBriefingStage(null);

    // LOCAL calendar day, not UTC — "today's briefing" means today on the
    // user's wall clock (see lib/dates.js for the UTC-drift rationale).
    const today = localDateStr();
    // Attach the hallucination check result to metadata so it persists
    // with the briefing entry in localStorage (previously transient
    // Zustand state lost on refresh).
    const metadataWithCheck = generationMetadata
      ? {
          ...generationMetadata,
          hallucinationCheck: finalCheck ? { ...finalCheck, retried } : null,
        }
      : undefined;
    // Build pipeline archive: filter buckets + scored papers (with their
    // adjustment trail) for retroactive "why did/didn't this paper appear?"
    // inspection. Persisted alongside the briefing so it survives refresh.
    const pipelineArchive = {
      filterResults: filterResults
        ? {
            total: filterResults.total ?? 0,
            yes: filterResults.yes ?? [],
            maybe: filterResults.maybe ?? [],
            no: filterResults.no ?? [],
          }
        : null,
      scoredPapers: results?.scoredPapers ?? [],
      finalRanking: results?.finalRanking ?? [],
    };

    await saveBriefing(today, finalBriefing, metadataWithCheck, {
      quickSummariesById: quickById,
      fullReportsById: fullById,
      pipelineArchive,
    });

    // Cache last analysis run to localStorage for in-session restore flows
    cacheLastAnalysisRun(finalRanking, quickById);
  } catch (err) {
    // Abort is not a synthesis failure. Normalize fetch's AbortError to the
    // pipeline's abort shape and re-throw so the caller's abort handling
    // (which suppresses the error) takes over instead of surfacing it.
    if (
      abortSignal?.aborted ||
      err?.name === 'AbortError' ||
      err?.message === 'Operation aborted'
    ) {
      throw new Error('Operation aborted');
    }
    setSynthesisError(String(err?.message ?? err));
  } finally {
    setSynthesizing(false);
    setBriefingStage(null);
  }
}
