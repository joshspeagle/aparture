// Client-side briefing generation orchestrator.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F4a).
//
// Owns the full flow: map papers → quick-summary fan-out → synthesize →
// hallucination check → optional retry → persist via saveBriefing.
// All React state updates go through injected setters; the module itself
// has no React imports and is unit-testable in isolation.

import { MODEL_REGISTRY } from '../../utils/models.js';

const QUICK_SUMMARY_CONCURRENCY = 5;
const LAST_RUN_CACHE_KEY = 'aparture-last-analysis-run';

function resolveProvider(modelId) {
  const modelCfg = MODEL_REGISTRY[modelId];
  const rawProvider = modelCfg?.provider ?? 'Google';
  return rawProvider.toLowerCase();
}

function mapFinalRankingToBriefingPapers(finalRanking) {
  return finalRanking.map((p) => ({
    arxivId: p.arxivId ?? p.id,
    title: p.title,
    abstract: p.abstract ?? '',
    score: p.score ?? p.finalScore ?? 0,
    scoringJustification: p.justification ?? p.relevanceAssessment ?? '',
    fullReport: p.detailedSummary ?? p.pdfAnalysis?.summary ?? p.analysis ?? '',
  }));
}

// Generate per-paper quick summaries in parallel chunks. Returns a map
// keyed by arxivId. Failures on individual papers are swallowed so the
// batch completes — the briefing still runs, just with fewer inline
// expansions.
async function generateQuickSummaries({ papers, provider, modelId, password }) {
  const quickById = {};
  const papersWithReports = papers.filter((p) => p.fullReport);
  for (let i = 0; i < papersWithReports.length; i += QUICK_SUMMARY_CONCURRENCY) {
    const chunk = papersWithReports.slice(i, i + QUICK_SUMMARY_CONCURRENCY);
    await Promise.all(
      chunk.map(async (p) => {
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
          });
          if (res.ok) {
            const json = await res.json();
            quickById[p.arxivId] = json.quickSummary;
          }
        } catch {
          // Non-fatal: a single paper's quick summary failing does not
          // block the rest of the batch or the main synthesis call.
        }
      })
    );
  }
  return quickById;
}

async function callSynthesize({
  profile,
  papers,
  history,
  provider,
  modelId,
  password,
  retryHint = null,
}) {
  const body = {
    profile,
    papers,
    history,
    provider,
    model: modelId,
    password,
  };
  if (retryHint) body.retryHint = retryHint;
  const res = await fetch('/api/synthesize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'synthesis failed');
  return json;
}

// Hallucination check is non-fatal: if the route fails we return null so
// the caller falls back to trusting the original briefing.
async function callCheckBriefing({ briefingObj, papers, quickById, provider, modelId, password }) {
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
  });
  const json = await res.json();
  if (!res.ok) {
    console.warn('[Phase 1.5.1] Hallucination check failed:', json.error);
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
        scoringJustification: p.justification ?? p.relevanceAssessment ?? '',
        fullReport: p.detailedSummary ?? p.pdfAnalysis?.summary ?? p.analysis ?? '',
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
  briefingRetryOnYes = true,
  briefingRetryOnMaybe = false,
  profile,
  password,
  briefingHistory,
  saveBriefing,
  setSynthesizing,
  setSynthesisError,
  setBriefingCheckResult,
  setBriefingStage,
  setQuickSummariesById,
  setFullReportsById,
}) {
  setSynthesizing(true);
  setSynthesisError(null);
  setBriefingCheckResult(null);
  setBriefingStage('synthesizing');
  try {
    const finalRanking = results?.finalRanking ?? [];
    if (finalRanking.length === 0) {
      throw new Error('No final-ranking papers available to synthesize.');
    }

    // Falls back to pdfModel for legacy configs that predate briefingModel.
    const modelId = briefingModel ?? pdfModel ?? 'gemini-3.1-pro';
    const provider = resolveProvider(modelId);

    const papers = mapFinalRankingToBriefingPapers(finalRanking);

    // Populate fullById synchronously (no network calls).
    const fullById = {};
    for (const p of papers) {
      fullById[p.arxivId] = p.fullReport;
    }

    const quickById = await generateQuickSummaries({ papers, provider, modelId, password });
    setQuickSummariesById(quickById);
    setFullReportsById(fullById);

    const history = briefingHistory.map((h) => ({
      date: h.date,
      paperIds: (h.briefing.papers ?? []).map((pp) => pp.arxivId),
    }));

    // First synthesis pass
    const synthJson = await callSynthesize({
      profile: profile.content,
      papers,
      history,
      provider,
      modelId,
      password,
    });
    let finalBriefing = synthJson.briefing;
    let finalCheck = null;
    let retried = false;

    // Hallucination check + optional retry
    setBriefingStage('checking');
    finalCheck = await callCheckBriefing({
      briefingObj: finalBriefing,
      papers,
      quickById,
      provider,
      modelId,
      password,
    });

    if (finalCheck) {
      const shouldRetry =
        (finalCheck.verdict === 'YES' && briefingRetryOnYes) ||
        (finalCheck.verdict === 'MAYBE' && briefingRetryOnMaybe);

      if (shouldRetry) {
        setBriefingStage('retrying');
        const retryHint = `A hallucination check on your previous briefing returned ${finalCheck.verdict}. Reason: ${finalCheck.justification} Ground all claims strictly in the provided source material this time.`;
        try {
          const retryJson = await callSynthesize({
            profile: profile.content,
            papers,
            history,
            provider,
            modelId,
            password,
            retryHint,
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
          });
          if (recheck) finalCheck = recheck;
          retried = true;
        } catch (retryErr) {
          console.warn('[Phase 1.5.1] Retry synthesis failed, keeping original:', retryErr);
        }
      }
    }

    setBriefingCheckResult(finalCheck ? { ...finalCheck, retried } : null);
    setBriefingStage(null);

    const today = new Date().toISOString().slice(0, 10);
    saveBriefing(today, finalBriefing);

    // Cache for PreviewPanel (Phase 1.5)
    cacheLastAnalysisRun(finalRanking, quickById);
  } catch (err) {
    setSynthesisError(String(err?.message ?? err));
  } finally {
    setSynthesizing(false);
    setBriefingStage(null);
  }
}
