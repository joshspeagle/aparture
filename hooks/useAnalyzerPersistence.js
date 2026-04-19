// localStorage persistence for the ArxivAnalyzer shell.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F3).
//
// Owns:
// - DEFAULT_CONFIG + readInitialConfig (synchronous lazy state initializer
//   used as useState(readInitialConfig) so hooks that depend on config see
//   the real persisted values on first render, not the hardcoded default).
// - The on-mount load effect that restores non-config state.
// - The debounced save effect that writes the full session snapshot.

import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'arxivAnalyzerState';
const SAVE_DEBOUNCE_MS = 400;

export const DEFAULT_CONFIG = {
  version: 2,
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
  maxRetries: 1,
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
};

// Migrate legacy config shapes in place. Returns the mutated parsed.config
// (or null if the config should be discarded in favor of fresh defaults).
function migrateLegacyConfig(config) {
  // Old `categories` string → selectedCategories array
  if (config.categories && !config.selectedCategories) {
    config.selectedCategories = config.categories
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c);
    delete config.categories;
  }

  // Outdated version → fresh defaults
  if (!config.version || config.version < DEFAULT_CONFIG.version) {
    return null;
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
}) {
  // Load on mount. Config is already restored by readInitialConfig at
  // useState init time, so this effect only restores non-config state.
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.results) setResults(parsed.results);
      if (parsed.filterResults) {
        // Restore persisted verdicts; reset transient progress fields so a
        // refresh mid-run doesn't strand the UI in an 'inProgress' state.
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
    } catch (e) {
      console.error('Failed to load saved state:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save. A trailing 400ms debounce stops ~167 sequential
  // stringifies during a 500-paper filter batch loop.
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    const hasResults =
      (results?.allPapers?.length ?? 0) > 0 ||
      (results?.scoredPapers?.length ?? 0) > 0 ||
      (filterResults?.yes?.length ?? 0) > 0 ||
      (filterResults?.maybe?.length ?? 0) > 0 ||
      (filterResults?.no?.length ?? 0) > 0;
    if (!hasResults && !password) return undefined;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          config,
          results,
          filterResults: {
            total: filterResults.total,
            yes: filterResults.yes,
            maybe: filterResults.maybe,
            no: filterResults.no,
          },
          processingTiming,
          testState,
          notebookLM: {
            duration: podcastDuration,
            model: notebookLMModel,
            content: notebookLMContent,
          },
          password: isAuthenticated ? password : '',
        })
      );
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
