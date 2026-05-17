// localStorage persistence for the ArxivAnalyzer shell.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F3).
//
// Owns:
// - DEFAULT_CONFIG + readInitialConfig (synchronous lazy state initializer
//   used as useState(readInitialConfig) so hooks that depend on config see
//   the real persisted values on first render, not the hardcoded default).
// - The on-mount load effect that restores non-config state.
// - The debounced save effect that writes a tiered session snapshot:
//   hot tier (localStorage, capped ~600KB via buildHotEntry) + cold tier
//   (filesystem via POST /api/sessions, full results + filter verdicts).
//
// Tiered store mirrors hooks/useBriefing.js (briefings tier shipped 2026-04-21).
// Heavy fields (results.allPapers, results.scoredPapers, full filterResults
// arrays) are dropped from the hot blob — they live only on disk now.

import { useEffect, useRef } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import { buildHotEntry, buildColdEntry } from '../lib/session/buildHotEntry.js';

const STORAGE_KEY = 'arxivAnalyzerState';
const SAVE_DEBOUNCE_MS = 400;

function generateSessionId() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DEFAULT_CONFIG = {
  version: 8,
  selectedCategories: [
    'cs.AI',
    'cs.CL',
    'cs.CV',
    'cs.IR',
    'cs.LG',
    'cs.MA',
    'cs.NE',
    'stat.AP',
    'stat.CO',
    'stat.ME',
    'stat.ML',
    'stat.OT',
    'stat.TH',
    'astro-ph.CO',
    'astro-ph.EP',
    'astro-ph.GA',
    'astro-ph.HE',
    'astro-ph.IM',
    'astro-ph.SR',
  ],
  scoringCriteria: `**Core Methodological Interests:**
**Statistical Learning:** Deep learning advances, general ML methods, novel architectures and training techniques with practical applications
**Uncertainty Quantification & Robustness:** Principled approaches to model uncertainty, calibration, conformal prediction, robustness evaluation, out-of-distribution detection, Bayesian deep learning
**Mechanistic Interpretability:** Understanding how models work internally, feature attribution, causal discovery in neural networks—not just making them "more honest" through prompting
**Advanced Statistical Methods:** Novel sampling/inference techniques, variational inference, hierarchical modeling, state space models, time series analysis, probabilistic programming innovations
**AI for Scientific Discovery:** Methods specifically designed to accelerate scientific understanding, not just routine applications of existing ML to new domains. Be highly selective with LLM papers—only major architectural innovations or fundamental breakthroughs, not incremental applications or fine-tuning studies.

**Astrophysics Domain Interests:**
**Galaxy Formation & Evolution:** Observational studies of galaxy assembly, galaxy populations, high-redshift galaxies, environmental effects, chemical evolution, quenching, morphological evolution
**Stellar Populations & Evolution:** Stellar activity, stellar populations as galactic tracers, stellar physics and evolution, star clusters, star formation processes
**Milky Way Structure & Dynamics:** Galactic structure, stellar kinematics, dark matter distribution, Galactic archaeology, stellar streams, near-field cosmology
**Large Survey Science:** Multi-wavelength surveys, time-domain astronomy, statistical methods for large astronomical datasets, survey strategy and design

**Research Philosophy:** Values EITHER (1) fundamental methodological advances in general OR (2) significant observational/data-driven astrophysical insights. Papers excelling in ANY category above should score highly - they do NOT need to match multiple domains. A landmark ML paper should score as highly as a landmark astrophysics paper. Focus on work that advances understanding through empirical analysis rather than purely theoretical frameworks.`,
  maxDeepAnalysis: 30,
  finalOutputCount: 30,
  daysBack: 1,
  batchSize: 3,
  maxCorrections: 1,
  // 5 attempts (initial + 4 retries) with exponential + jittered backoff in
  // makeRobustAPICall covers a ~31s quota dip — well within Gemini's 60s
  // RPM reset window. Tunable via Settings.
  maxRetries: 4,
  useQuickFilter: true,
  filterModel: 'gemini-3.1-flash-lite',
  filterBatchSize: 3,
  // Number of filter batches fired in parallel. Clamped 1–20 in pipeline.js.
  filterConcurrency: 3,
  categoriesToScore: ['YES', 'MAYBE'],
  scoringModel: 'gemini-3-flash',
  scoringBatchSize: 3,
  // Number of scoring batches fired in parallel. Clamped 1–20 in pipeline.js.
  scoringConcurrency: 3,
  enableScorePostProcessing: true,
  postProcessingCount: 50,
  postProcessingBatchSize: 5,
  postProcessingModel: 'gemini-3-flash',
  // Number of post-processing (Stage 3.5) batches fired in parallel. Clamped 1–20.
  postProcessingConcurrency: 3,
  pdfModel: 'gemini-3.1-pro',
  // Stage 3 parallel analysis width. Default 3 is safe across provider tiers
  // (Anthropic Tier 1 with cache warmup; Google/OpenAI have headroom). Clamped
  // 1–20 in pipeline.js.
  pdfAnalysisConcurrency: 3,
  briefingModel: 'gemini-3.1-pro',
  // Quick summaries compress each full PDF analysis into a ~300-word pre-read.
  // Small/cheap text-only model is appropriate (input is the text of the full
  // report, not the PDF). Flash-Lite by default; fall back to briefingModel if
  // this slot is unset in a legacy config.
  quickSummaryModel: 'gemini-3.1-flash-lite',
  // Number of quick-summary calls fired in parallel during briefing prep.
  // Provider rate limits are the practical ceiling; default 5 is conservative.
  quickSummaryConcurrency: 5,
  pauseAfterFilter: true,
  pauseBeforeBriefing: true,
  briefingRetryOnYes: true,
  briefingRetryOnMaybe: false,
  maxAbstractDisplay: 500,
  arxivIngestion: 'auto',
  minPapersPerSubcategory: 5,
  lookbackExtensions: [3, 7, 14],
  arxivCacheTtlMinutes: 60,
  arxivWindowSemantics: 'submitted-only',
  // Duplicate detection: when true (default), papers seen in any session
  // run within the last 90 days are dropped from the fetch result before
  // any LLM call. When false, duplicates are kept but tagged with
  // isDuplicate/firstSeenDate and rendered with a "seen before" badge.
  removeDuplicates: true,
  // MS gate: when true (default), the pipeline pauses before launching
  // Stage 4 PDF analysis so the user can review the top-N list and
  // star/dismiss papers before committing to (potentially expensive) PDF runs.
  pauseBeforeDeepAnalysis: true,
};

// Migrate legacy config shapes in place. Returns the mutated parsed.config
// (or null if the config should be discarded in favor of fresh defaults).
export function migrateLegacyConfig(config) {
  // Old `categories` string → selectedCategories array
  if (config.categories && !config.selectedCategories) {
    config.selectedCategories = config.categories
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c);
    delete config.categories;
  }

  // Outdated version → fresh defaults
  if (!config.version || config.version < 2) {
    return null;
  }

  // v2 → v3: introduces arxivIngestion key. v2 users predate the new default,
  // so give them the same 'auto' default as fresh installs — they can opt out
  // via advanced settings if the breaker fallback ever surprises them.
  if (config.version === 2) {
    config.arxivIngestion = 'auto';
    config.version = 3;
  }

  // v3 → v4: introduces fill-up controls (matches DEFAULT_CONFIG values).
  if (config.version === 3) {
    config.minPapersPerSubcategory = 5;
    config.lookbackExtensions = [3, 7, 14];
    config.version = 4;
  }

  // v4 → v5: introduces arxivCacheTtlMinutes (matches DEFAULT_CONFIG value).
  if (config.version === 4) {
    config.arxivCacheTtlMinutes = 60;
    config.version = 5;
  }

  // v5 → v6: introduces arxivWindowSemantics. Default 'submitted-only' preserves
  // pre-OAI behavior (drops v2-of-old papers); users opt in to 'submitted-or-updated'.
  if (config.version === 5) {
    config.arxivWindowSemantics = 'submitted-only';
    config.version = 6;
  }

  // v6 → v7: introduces removeDuplicates. Default `true` matches new installs.
  if (config.version === 6) {
    config.removeDuplicates = true;
    config.version = 7;
  }

  // v7 → v8: introduces pauseBeforeDeepAnalysis. Default `true` matches new
  // installs; use ?? so an explicit `false` in a v7 config is preserved.
  if (config.version === 7) {
    config.pauseBeforeDeepAnalysis = config.pauseBeforeDeepAnalysis ?? true;
    config.version = 8;
  }

  // Two-model → three-model setup
  if (config.screeningModel && !config.scoringModel) {
    config.filterModel = 'gemini-3.1-flash-lite';
    config.scoringModel = config.screeningModel;
    config.pdfModel = config.deepAnalysisModel;
    config.filterBatchSize = 3;
    config.scoringBatchSize = config.batchSize || 3;
    config.useQuickFilter = false;
    config.categoriesToScore = ['YES', 'MAYBE'];
    delete config.screeningModel;
    delete config.deepAnalysisModel;
  }

  // Single-model → three-model setup
  if (config.selectedModel) {
    config.filterModel = 'gemini-3.1-flash-lite';
    config.scoringModel = 'gemini-3-flash';
    config.pdfModel = config.selectedModel;
    delete config.selectedModel;
  }

  return config;
}

// Synchronously read the persisted config on first render so hooks that
// depend on config.scoringCriteria (notably useProfile) see the real value,
// not the default. SSR-safe.
export function readInitialConfig() {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed?.config) return DEFAULT_CONFIG;

    const migrated = migrateLegacyConfig(parsed.config);
    if (!migrated) return DEFAULT_CONFIG;

    const merged = { ...DEFAULT_CONFIG, ...migrated };
    // Phase 1.5: briefingModel inherits from pdfModel for Phase 1 upgraders
    if (merged.briefingModel === undefined || merged.briefingModel === null) {
      merged.briefingModel = merged.pdfModel ?? DEFAULT_CONFIG.briefingModel;
    }
    return merged;
  } catch {
    return DEFAULT_CONFIG;
  }
}

// Lazy-fetch the cold-tier session payload by id. Returns null on any
// failure (404, network, parse) so the load effect can fall through to
// the hot-tier-only state.
async function fetchColdSession(sessionId, password) {
  if (!sessionId) return null;
  try {
    const res = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}?password=${encodeURIComponent(password ?? '')}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('[useAnalyzerPersistence] failed to load cold session:', err);
    return null;
  }
}

export function useAnalyzerPersistence({
  // state values (for save)
  config,
  results,
  filterResults,
  processingTiming,
  testState,
  podcastDuration,
  notebookLMModel,
  notebookLMContent,
  password,
  isAuthenticated,
  // setters (for load)
  setResults,
  setFilterResults,
  setProcessingTiming,
  setTestState,
  setPodcastDuration,
  setNotebookLMModel,
  setNotebookLMContent,
  setPassword,
  setIsAuthenticated,
  // Optional callback fired after a successful cold-tier session POST.
  // Receives (allPapers, saveTimestamp) where saveTimestamp is Date.now() at
  // write time, captured before the fetch (so retries-with-the-same-payload
  // don't drift the recorded date). Used by useSeenPapers to grow its
  // dedupe index incrementally; not invoked when the POST fails or when
  // the cold tier is skipped (no results yet / not authenticated).
  onColdSessionSaved,
}) {
  // Persistent session id. Read from the hot blob on first load if present;
  // otherwise lazily generated on the first save. Survives renders via ref.
  const sessionIdRef = useRef(null);

  // Load on mount. Config is already restored by readInitialConfig at
  // useState init time, so this effect only restores non-config state.
  // Two paths:
  //   1) New (tiered) blob — hot tier carries finalRanking + filter counts;
  //      full allPapers/scoredPapers/verdicts come from cold tier via fetch.
  //   2) Legacy blob — full results + filterResults inline; restored as-is.
  //      No migration: next save converts to tiered shape.
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse saved analyzer state:', e);
      return;
    }

    // Adopt the hot blob's sessionId if present so subsequent saves write
    // back to the same cold-tier file.
    if (parsed.sessionId) sessionIdRef.current = parsed.sessionId;

    // Restore hot-tier fields synchronously. Legacy blobs carry full results
    // here; new blobs carry only finalRanking. Either way, this is what the
    // first render sees.
    if (parsed.results) setResults(parsed.results);
    if (parsed.filterResults) {
      // Legacy blob has yes/maybe/no arrays; tiered blob has only counts.
      // Either way, reset transient progress fields so a refresh mid-run
      // doesn't strand the UI in an 'inProgress' state.
      setFilterResults({
        total: parsed.filterResults.total ?? 0,
        yes: parsed.filterResults.yes ?? [],
        maybe: parsed.filterResults.maybe ?? [],
        no: parsed.filterResults.no ?? [],
        inProgress: false,
        currentBatch: 0,
        totalBatches: 0,
      });
    }
    if (parsed.processingTiming) {
      const timing = { ...parsed.processingTiming };
      if (timing.startTime) timing.startTime = new Date(timing.startTime);
      if (timing.endTime) timing.endTime = new Date(timing.endTime);
      setProcessingTiming(timing);
    }
    if (parsed.testState) setTestState(parsed.testState);
    if (parsed.notebookLM) {
      if (parsed.notebookLM.duration) setPodcastDuration(parsed.notebookLM.duration);
      if (parsed.notebookLM.model) setNotebookLMModel(parsed.notebookLM.model);
      if (parsed.notebookLM.content) setNotebookLMContent(parsed.notebookLM.content);
    }
    if (parsed.password) {
      setPassword(parsed.password);
      setIsAuthenticated(true);
    }

    // Tiered blob with sessionId but missing heavy fields → fetch cold tier.
    // Detection: hot blob says sessionId + no allPapers/scoredPapers in
    // results. Legacy blobs always have allPapers if they have results, so
    // they don't trigger the fetch.
    const hotHasHeavy =
      (parsed.results?.allPapers?.length ?? 0) > 0 ||
      (parsed.results?.scoredPapers?.length ?? 0) > 0;
    if (parsed.sessionId && !hotHasHeavy) {
      fetchColdSession(parsed.sessionId, parsed.password).then((cold) => {
        if (!cold) return;
        // Merge cold heavy fields into the existing hot finalRanking so
        // we don't overwrite it with whatever the cold tier had (cold may
        // be slightly stale if save was mid-flight at refresh time).
        // Spread `prev` and `cold.results` so non-canonical slice fields
        // (e.g. `failedPapers` from scoreAbstracts) survive the round-trip.
        setResults((prev) => ({
          ...(prev ?? {}),
          ...(cold.results ?? {}),
          allPapers: cold.results?.allPapers ?? [],
          scoredPapers: cold.results?.scoredPapers ?? [],
          finalRanking: prev?.finalRanking?.length
            ? prev.finalRanking
            : (cold.results?.finalRanking ?? []),
        }));
        if (cold.filterResults) {
          setFilterResults((prev) => ({
            total: cold.filterResults.total ?? prev.total ?? 0,
            yes: cold.filterResults.yes ?? [],
            maybe: cold.filterResults.maybe ?? [],
            no: cold.filterResults.no ?? [],
            inProgress: false,
            currentBatch: 0,
            totalBatches: 0,
          }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save. A trailing 400ms debounce stops ~167 sequential
  // stringifies during a 500-paper filter batch loop.
  //
  // Two tiers per save:
  //   1) Hot (localStorage): buildHotEntry → safeSetItem. Stays under quota
  //      because allPapers/scoredPapers/full verdicts are excluded.
  //   2) Cold (filesystem): buildColdEntry → fire-and-forget POST. Best
  //      effort; failures log but don't disrupt the live run.
  const onColdSessionSavedRef = useRef(onColdSessionSaved);
  useEffect(() => {
    onColdSessionSavedRef.current = onColdSessionSaved;
  }, [onColdSessionSaved]);

  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    const hasResults =
      (results?.allPapers?.length ?? 0) > 0 ||
      (results?.scoredPapers?.length ?? 0) > 0 ||
      (results?.finalRanking?.length ?? 0) > 0 ||
      (filterResults?.yes?.length ?? 0) > 0 ||
      (filterResults?.maybe?.length ?? 0) > 0 ||
      (filterResults?.no?.length ?? 0) > 0;
    if (!hasResults && !password) return undefined;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      // Lazy session-id allocation. Subsequent saves reuse the same id so
      // the cold-tier file is overwritten in place rather than churning.
      if (!sessionIdRef.current) sessionIdRef.current = generateSessionId();
      const sessionId = sessionIdRef.current;

      // Hot tier — bounded blob, safe under localStorage quota.
      const hotEntry = buildHotEntry({
        config,
        sessionId,
        finalRanking: results?.finalRanking,
        filterResults,
        processingTiming,
        testState,
        podcastDuration,
        notebookLMModel,
        notebookLMContent,
        password,
        isAuthenticated,
      });
      const ok = safeSetItem(STORAGE_KEY, JSON.stringify(hotEntry));
      if (!ok) {
        console.warn(
          '[useAnalyzerPersistence] localStorage quota exceeded; analyzer state could not be persisted (in-memory state preserved for this session)'
        );
      }

      // Cold tier — full payload, only POSTed when there's actual results
      // worth shipping to disk. Skips empty saves (password-only changes
      // don't need a cold write). Best-effort.
      if (hasResults && isAuthenticated && password) {
        const coldEntry = buildColdEntry({
          sessionId,
          results,
          filterResults,
          processingTiming,
        });
        // Capture both the timestamp AND the allPapers snapshot before the
        // fetch so they stay paired even if `results` mutates while the
        // request is in flight.
        const saveTimestamp = Date.now();
        const papersSnapshot = results?.allPapers ?? [];
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, entry: coldEntry }),
        })
          .then((res) => {
            if (!res.ok) {
              console.warn(
                '[useAnalyzerPersistence] cold session POST returned HTTP ' + res.status
              );
              return;
            }
            const cb = onColdSessionSavedRef.current;
            if (cb) cb(papersSnapshot, saveTimestamp);
          })
          .catch((err) => {
            console.warn('[useAnalyzerPersistence] failed to persist session to disk:', err);
          });
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [
    config,
    results,
    filterResults,
    processingTiming,
    testState,
    podcastDuration,
    notebookLMModel,
    notebookLMContent,
    password,
    isAuthenticated,
  ]);
}
