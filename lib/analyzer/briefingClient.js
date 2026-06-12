// Client-side briefing generation orchestrator.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F4a).
//
// Owns the full flow: map papers → quick-summary fan-out → synthesize →
// hallucination check → optional retry → persist via saveBriefing.
// All React state updates go through injected setters; the module itself
// has no React imports and is unit-testable in isolation.

import { MODEL_REGISTRY } from '../../utils/models.js';
import { composeFullReport } from './composeFullReport.js';
import { parseRouteError } from './RateLimitError.js';
import { AnalysisWorkerPool } from './rateLimit.js';

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
// map keyed by arxivId. Failures on individual papers are swallowed so the
// batch completes — the briefing still runs, just with fewer inline
// expansions. The pool keeps all N lanes busy (no straggler serialization
// at chunk boundaries) and stops dispatching when abortSignal fires.
async function generateQuickSummaries({
  papers,
  provider,
  modelId,
  password,
  concurrency,
  abortSignal,
}) {
  const quickById = {};
  const papersWithReports = papers.filter((p) => p.fullReport);
  // The pool clamps concurrency to 1–20, so a corrupted config can't stall
  // the run or drown the provider in simultaneous requests.
  const pool = new AnalysisWorkerPool({ concurrency: concurrency ?? 5, abortSignal });
  await pool.run(papersWithReports, async (p) => {
    try {
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
      if (res.ok) {
        const json = await res.json();
        quickById[p.arxivId] = json.quickSummary;
      }
    } catch {
      // Non-fatal: a single paper's quick summary failing (or being
      // aborted mid-flight) does not block the rest of the batch or the
      // main synthesis call.
    }
  });
  return quickById;
}

async function callSynthesize({
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
  const res = await fetch('/api/synthesize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal ?? undefined,
  });
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
  abortSignal = null,
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
    const modelId = briefingModel ?? pdfModel ?? 'gemini-3.1-pro';
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
    });
    throwIfAborted();
    setQuickSummariesById(quickById);
    setFullReportsById(fullById);

    // First synthesis pass
    const synthJson = await callSynthesize({
      profile: profile.content,
      papers,
      provider,
      modelId,
      password,
      signal: abortSignal,
    });
    let finalBriefing = synthJson.briefing;
    let finalCheck = null;
    let retried = false;

    // Hallucination check + optional retry
    throwIfAborted();
    setBriefingStage('checking');
    finalCheck = await callCheckBriefing({
      briefingObj: finalBriefing,
      papers,
      quickById,
      provider,
      modelId,
      password,
      signal: abortSignal,
    });

    if (finalCheck) {
      const shouldRetry =
        (finalCheck.verdict === 'YES' && briefingRetryOnYes) ||
        (finalCheck.verdict === 'MAYBE' && briefingRetryOnMaybe);

      if (shouldRetry) {
        throwIfAborted();
        setBriefingStage('retrying');
        const retryHint = `A hallucination check on your previous briefing returned ${finalCheck.verdict}. Reason: ${finalCheck.justification} Ground all claims strictly in the provided source material this time.`;
        try {
          const retryJson = await callSynthesize({
            profile: profile.content,
            papers,
            provider,
            modelId,
            password,
            retryHint,
            signal: abortSignal,
          });
          finalBriefing = retryJson.briefing;
          // Re-run the check on the retry so the badge reflects the final state
          setBriefingStage('checking');
          const recheck = await callCheckBriefing({
            briefingObj: finalBriefing,
            papers,
            quickById,
            provider,
            modelId,
            password,
            signal: abortSignal,
          });
          if (recheck) finalCheck = recheck;
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

    const today = new Date().toISOString().slice(0, 10);
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
