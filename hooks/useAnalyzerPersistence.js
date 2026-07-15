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
import { DEFAULT_MODEL_ID, MODEL_REGISTRY } from '../utils/models.js';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import { encodePasswordHeader } from '../lib/auth/passwordHeader.js';
import { buildHotEntry, buildColdEntry } from '../lib/session/buildHotEntry.js';
import { BLANK_PROFILE_TEMPLATE } from '../lib/profile/starterTemplates.js';
import { useAnalyzerStore } from '../stores/analyzerStore.js';

const STORAGE_KEY = 'arxivAnalyzerState';
const SAVE_DEBOUNCE_MS = 400;

function generateSessionId() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// 2026-07 model-registry refresh: retired/removed model IDs → their closest
// current-generation replacement. Shared between the v8→v9 config migration
// (which walks config's model slots) and the load effect's notebookLM.model
// repair — the notebookLM model does NOT live in config (it persists at
// hotEntry.notebookLM.model, see lib/session/buildHotEntry.js), so the config
// migration alone can't fix it.
export const RETIRED_MODEL_REMAP = {
  'claude-haiku-3.5': 'claude-haiku-4.5',
  'claude-opus-4.1': 'claude-opus-4-8',
  'claude-opus-4.5': 'claude-opus-4-8',
  'claude-sonnet-4.5': 'claude-sonnet-5',
};

export const DEFAULT_CONFIG = {
  version: 9,
  // Neutral first-run defaults (2026-07): fresh installs get a small starter
  // category set and the bracketed fill-in profile template instead of a
  // personal research profile. The old shipped profile lives on as the
  // 'breadth-example' entry in lib/profile/starterTemplates.js. Existing
  // users are unaffected — readInitialConfig merges their saved config over
  // these defaults, and both keys exist in every v2+ saved config.
  selectedCategories: ['cs.LG', 'stat.ML'],
  scoringCriteria: BLANK_PROFILE_TEMPLATE,
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
  scoringModel: 'gemini-3.5-flash',
  scoringBatchSize: 3,
  // Number of scoring batches fired in parallel. Clamped 1–20 in pipeline.js.
  scoringConcurrency: 3,
  enableScorePostProcessing: true,
  postProcessingCount: 50,
  postProcessingBatchSize: 5,
  postProcessingModel: 'gemini-3.5-flash',
  // Number of post-processing (Stage 3.5) batches fired in parallel. Clamped 1–20.
  postProcessingConcurrency: 3,
  pdfModel: 'gemini-3.5-flash',
  // Stage 3 parallel analysis width. Default 3 is safe across provider tiers
  // (Anthropic Tier 1 with cache warmup; Google/OpenAI have headroom). Clamped
  // 1–20 in pipeline.js.
  pdfAnalysisConcurrency: 3,
  briefingModel: 'gemini-3.5-flash',
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

// Integer config fields (all edited via SettingsPanel's integerInputProps).
// The panel allows '' while typing and clamps on blur — but the 400ms
// debounced save can persist the in-flight '' (and blur never runs if the
// tab closes), so numeric keys could reload as '' and break slicing math
// (`.slice(0, '')` → empty top-N). normalizeIntegerConfigFields restores the
// DEFAULT_CONFIG value for any non-finite entry; applied both at load
// (readInitialConfig) and at save (debounced effect) so bad values neither
// persist nor survive a reload.
export const INTEGER_CONFIG_KEYS = [
  'maxDeepAnalysis',
  'finalOutputCount',
  'daysBack',
  'batchSize',
  'maxCorrections',
  'maxRetries',
  'filterBatchSize',
  'filterConcurrency',
  'scoringBatchSize',
  'scoringConcurrency',
  'postProcessingCount',
  'postProcessingBatchSize',
  'postProcessingConcurrency',
  'pdfAnalysisConcurrency',
  'quickSummaryConcurrency',
  'maxAbstractDisplay',
  'minPapersPerSubcategory',
  'arxivCacheTtlMinutes',
];

export function normalizeIntegerConfigFields(config) {
  let changed = false;
  const next = { ...config };
  for (const key of INTEGER_CONFIG_KEYS) {
    if (typeof next[key] !== 'number' || !Number.isFinite(next[key])) {
      next[key] = DEFAULT_CONFIG[key];
      changed = true;
    }
  }
  return changed ? next : config;
}

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

  // v8 → v9: 2026-07 model-registry refresh. Removed Anthropic entries are
  // remapped to their closest current-generation equivalent in every model
  // slot: claude-haiku-3.5's apiId was retired upstream (live 404 since
  // 2026-02-19), claude-opus-4.1 retires 2026-08-05, and claude-opus-4.5 /
  // claude-sonnet-4.5 predate adaptive thinking (400 against the current
  // Anthropic adapter). Google defaults also moved to GA gemini-3.5-flash,
  // but existing preview selections are left alone — they still work.
  if (config.version === 8) {
    const modelSlots = [
      'filterModel',
      'scoringModel',
      'postProcessingModel',
      'pdfModel',
      'briefingModel',
      'quickSummaryModel',
      'notebookLMModel',
    ];
    for (const slot of modelSlots) {
      const mapped = RETIRED_MODEL_REMAP[config[slot]];
      if (mapped) config[slot] = mapped;
    }
    config.version = 9;
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
    // Repair integer fields persisted mid-edit as '' (see
    // normalizeIntegerConfigFields) so numeric keys never reload as ''.
    return normalizeIntegerConfigFields(merged);
  } catch {
    return DEFAULT_CONFIG;
  }
}

// Number of cold-session POST attempts before we give up and warn the user.
// Most failures are transient (disk contention, dropped connection, 5xx/429);
// a short retry ladder recovers those without poisoning the UX. Permanent
// client errors (413 oversized body, other 4xx) bypass the ladder via
// isRetryableStatus and fail after a single attempt — a retry can't help.
const COLD_SAVE_MAX_ATTEMPTS = 3;
const COLD_SAVE_BASE_DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Permanent client-error statuses that cannot succeed on retry with the same
// body. 413 (Payload Too Large) is the motivating case: a 30-paper run can
// exceed the 20mb body limit, and the body doesn't shrink between attempts, so
// retrying just wastes the backoff before surfacing the warning. The other 4xx
// here (400/401/403/404) are equally permanent for an identical request.
// Everything else — thrown/network errors, all 5xx, and the transient 408/429 —
// stays on the retry ladder.
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 413]);

// Decide whether a non-ok response status is worth retrying. Called only on
// responses (thrown/network errors are always retryable and handled in the
// catch block).
function isRetryableStatus(status) {
  return !NON_RETRYABLE_STATUSES.has(status);
}

// POST the cold-tier session entry with bounded retry + linear-ish backoff.
// Resolves true on the first HTTP-ok response, false once all attempts are
// exhausted OR a non-retryable status (413/4xx) is hit. Best-effort: never
// throws, so the live run is never disrupted.
async function postColdSessionWithRetry({ password, coldEntry }) {
  for (let attempt = 1; attempt <= COLD_SAVE_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, entry: coldEntry }),
      });
      if (res.ok) return true;
      // Fail fast on permanent client errors (e.g. 413 oversized body): a
      // retry with the same payload can't succeed, so don't burn the backoff.
      if (!isRetryableStatus(res.status)) {
        console.warn(
          `[useAnalyzerPersistence] cold session POST returned non-retryable HTTP ${res.status}; not retrying`
        );
        return false;
      }
      console.warn(
        `[useAnalyzerPersistence] cold session POST returned HTTP ${res.status} (attempt ${attempt}/${COLD_SAVE_MAX_ATTEMPTS})`
      );
    } catch (err) {
      console.warn(
        `[useAnalyzerPersistence] cold session POST threw (attempt ${attempt}/${COLD_SAVE_MAX_ATTEMPTS}):`,
        err
      );
    }
    if (attempt < COLD_SAVE_MAX_ATTEMPTS) {
      await delay(COLD_SAVE_BASE_DELAY_MS * attempt);
    }
  }
  return false;
}

// Lazy-fetch the cold-tier session payload by id. Returns null on any
// failure (404, network, parse) so the load effect can fall through to
// the hot-tier-only state.
async function fetchColdSession(sessionId, password) {
  if (!sessionId) return null;
  try {
    // Password travels in a header, not the query string (query values leak
    // into dev-server logs and browser history).
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { 'x-aparture-password': encodePasswordHeader(password) },
    });
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
  // Optional callback fired when the cold-tier session POST fails on every
  // retry attempt. Lets the shell surface a visible, non-blocking warning
  // (e.g. addError) so the user knows the heavy run data (allPapers /
  // scoredPapers / full verdicts — which live ONLY on disk) was not durably
  // saved and will be lost on refresh. The run/UI continues regardless.
  onColdSaveFailed,
}) {
  // Persistent session id. Read from the hot blob on first load if present;
  // otherwise lazily generated on the first save. Survives renders via ref.
  const sessionIdRef = useRef(null);

  // Reload-clobber guard. The mount-time hot restore (setResults + setPassword
  // below) re-triggers the debounced save effect, whose cold POST is built from
  // in-memory results where allPapers/scoredPapers/filter buckets are still
  // EMPTY (the hot blob only carries finalRanking + counts). Without a gate,
  // that POST overwrites the on-disk session file's heavy fields with empty
  // arrays — and if the in-flight cold GET then fails (or the tab closes in
  // the window), the run data is permanently destroyed. Cold POSTs are held
  // until the mount-time cold load has SETTLED: success, failure, or
  // nothing-to-load all count as settled. Fresh runs are unaffected — with no
  // sessionId/cold-fetch to wait on, the ref flips true synchronously on mount,
  // well before the first 400ms-debounced save fires.
  const coldLoadSettledRef = useRef(false);
  // Set when the mount-time cold GET failed for an ADOPTED (pre-existing)
  // sessionId: the on-disk file may still hold heavy data we couldn't read, so
  // additionally skip cold POSTs whose heavy fields are all empty — they could
  // only clobber. Cleared as soon as a save carries real heavy data (a new run
  // legitimately supersedes the old file).
  const blockEmptyColdSaveRef = useRef(false);

  // Load on mount. Config is already restored by readInitialConfig at
  // useState init time, so this effect only restores non-config state.
  // Two paths:
  //   1) New (tiered) blob — hot tier carries finalRanking + filter counts;
  //      full allPapers/scoredPapers/verdicts come from cold tier via fetch.
  //   2) Legacy blob — full results + filterResults inline; restored as-is.
  //      No migration: next save converts to tiered shape.
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      coldLoadSettledRef.current = true;
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse saved analyzer state:', e);
      coldLoadSettledRef.current = true;
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
    if (parsed.testState) {
      // Revive Date fields — JSON round-trips them as ISO strings, and
      // ControlPanel calls `.toLocaleString()` expecting real Dates (on a
      // string that renders the raw ISO text).
      const revivedTestState = { ...parsed.testState };
      for (const key of ['lastDryRunTime', 'lastMinimalTestTime']) {
        if (revivedTestState[key]) {
          const revived = new Date(revivedTestState[key]);
          revivedTestState[key] = Number.isNaN(revived.getTime()) ? null : revived;
        }
      }
      setTestState(revivedTestState);
    }
    if (parsed.notebookLM) {
      if (parsed.notebookLM.duration) setPodcastDuration(parsed.notebookLM.duration);
      if (parsed.notebookLM.model) {
        // The notebookLM model persists OUTSIDE config (hotEntry.notebookLM),
        // so the v8→v9 config migration never sees it. Remap retired IDs here
        // and fall back to the default when the stored ID (remapped or not)
        // isn't in the registry — restoring an unknown ID would leave the
        // Select with no matching option and /api/generate-notebooklm
        // returning a persistent 400 until the user re-picks manually.
        const remapped = RETIRED_MODEL_REMAP[parsed.notebookLM.model] ?? parsed.notebookLM.model;
        setNotebookLMModel(MODEL_REGISTRY[remapped] ? remapped : DEFAULT_MODEL_ID);
      }
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
        coldLoadSettledRef.current = true;
        if (!cold) {
          // The adopted sessionId's on-disk file couldn't be read but may
          // still exist with heavy data — block empty-heavy cold POSTs from
          // overwriting it (see blockEmptyColdSaveRef above).
          blockEmptyColdSaveRef.current = true;
          return;
        }
        // Staleness guard: if a new run started while this GET was in flight,
        // merging the PREVIOUS run's heavy data over the in-flight run's
        // state would corrupt it. The new run repopulates everything itself.
        if (useAnalyzerStore.getState().processing.isRunning) return;
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
    } else {
      // Legacy blob (heavy fields inline) or no sessionId — no cold fetch to
      // wait on; saving may proceed immediately.
      coldLoadSettledRef.current = true;
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

  const onColdSaveFailedRef = useRef(onColdSaveFailed);
  useEffect(() => {
    onColdSaveFailedRef.current = onColdSaveFailed;
  }, [onColdSaveFailed]);

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
      // normalizeIntegerConfigFields: never persist an in-flight '' from the
      // Settings panel's freeform integer inputs.
      const hotEntry = buildHotEntry({
        config: normalizeIntegerConfigFields(config),
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
      //
      // Reload-clobber gate (see coldLoadSettledRef): while the mount-time
      // cold load is unsettled, the heavy fields here are empty hot-tier
      // restores, not real run data — POSTing them would overwrite the
      // on-disk session. Skipping is safe: the cold GET's merge (or any later
      // state change) re-triggers this effect and the next save lands.
      const heavyEmpty =
        (results?.allPapers?.length ?? 0) === 0 &&
        (results?.scoredPapers?.length ?? 0) === 0 &&
        (filterResults?.yes?.length ?? 0) === 0 &&
        (filterResults?.maybe?.length ?? 0) === 0 &&
        (filterResults?.no?.length ?? 0) === 0;
      const coldSaveBlocked =
        !coldLoadSettledRef.current || (blockEmptyColdSaveRef.current && heavyEmpty);
      if (hasResults && isAuthenticated && password && !coldSaveBlocked) {
        // Real heavy data legitimately supersedes an adopted on-disk file
        // whose mount-time GET failed — lift the empty-save block.
        if (!heavyEmpty) blockEmptyColdSaveRef.current = false;
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
        postColdSessionWithRetry({ password, coldEntry }).then((saved) => {
          if (saved) {
            const cb = onColdSessionSavedRef.current;
            if (cb) cb(papersSnapshot, saveTimestamp);
            return;
          }
          // All retries exhausted — the heavy run data lives only on disk, so
          // a refresh now loses it. Surface a visible, non-blocking warning.
          console.warn(
            '[useAnalyzerPersistence] cold session POST failed after all retries; run data not durably saved'
          );
          const onFail = onColdSaveFailedRef.current;
          if (onFail) {
            onFail(
              'Session results could not be saved to disk — they will be lost if you refresh. ' +
                'Try again, or reduce "Papers to Analyze" if this run is unusually large.'
            );
          }
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
