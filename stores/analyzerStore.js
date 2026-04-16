// Zustand store for ArxivAnalyzer state.
// Phase B-prep chunk 4: consolidates ~28 useState calls in
// components/ArxivAnalyzer.js into a single store. The store is
// independently testable, the pipeline reads from it directly via
// useAnalyzerStore.getState(), and no React Context provider is needed.

import { create } from 'zustand';

// Initial state factory — called from tests to reset between cases,
// and used once at store creation. Separated so the test harness can
// reset without re-importing the module.
export function initialState() {
  return {
    // --- processing slice ---
    // `errors` holds real failures. `statusLog` holds informational
    // progress messages (fetching, retry attempts, stage completions).
    // Both are timestamped on insertion by their respective actions.
    processing: {
      stage: 'idle',
      progress: { current: 0, total: 0 },
      errors: [],
      statusLog: [],
      isRunning: false,
      isPaused: false,
    },
    // --- results slice ---
    results: {
      allPapers: [],
      scoredPapers: [],
      finalRanking: [],
    },
    // --- filterResults slice ---
    filterResults: {
      total: 0,
      yes: [],
      maybe: [],
      no: [],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
    },
    // --- processingTiming slice ---
    processingTiming: {
      startTime: null,
      endTime: null,
      duration: null,
    },
    // --- testState slice ---
    testState: {
      dryRunCompleted: false,
      dryRunInProgress: false,
      minimalTestInProgress: false,
      lastDryRunTime: null,
      lastMinimalTestTime: null,
    },
    // --- notebookLM slice ---
    notebookLM: {
      podcastDuration: 20,
      notebookLMModel: 'gemini-3.1-pro',
      notebookLMStatus: '',
      notebookLMContent: null,
      notebookLMGenerating: false,
      enableHallucinationCheck: true,
      hallucinationWarning: null,
    },
    // --- briefingUI slice ---
    briefingUI: {
      synthesizing: false,
      synthesisError: null,
      briefingCheckResult: null,
      briefingStage: null,
      quickSummariesById: {},
      fullReportsById: {},
    },
    // --- auth slice (password + isAuthenticated) ---
    // NOTE: unlike other slices, these are FLAT top-level keys (not
    // wrapped in an `auth: {...}` object). Task 4b consumers should
    // read them as `useAnalyzerStore((s) => s.password)`, NOT
    // `useAnalyzerStore((s) => s.auth.password)`.
    password: '',
    isAuthenticated: false,
    // --- reactContext slice ---
    // Mirror of React-hook-derived values (profile, currentBriefing,
    // feedback, config) that the pipeline needs to read but which don't
    // live in the store naturally. ArxivAnalyzer publishes these via a
    // useEffect on every render.
    reactContext: {
      profile: null,
      currentBriefing: null,
      feedback: null,
      config: null,
      saveBriefing: null,
      briefingHistory: null,
    },
  };
}

// Small helper: accept either a patch object or a functional updater
// and produce the next slice value. Matches the React useState
// setter API so existing call sites migrate with minimal changes.
function applyPatch(currentSlice, updater) {
  if (typeof updater === 'function') {
    return updater(currentSlice);
  }
  return { ...currentSlice, ...updater };
}

export const useAnalyzerStore = create((set) => ({
  ...initialState(),

  // --- processing slice actions ---
  setProcessing: (updater) =>
    set((state) => ({ processing: applyPatch(state.processing, updater) })),
  addError: (message) =>
    set((state) => ({
      processing: {
        ...state.processing,
        errors: [...state.processing.errors, `[${new Date().toLocaleTimeString()}] ${message}`],
      },
    })),
  addStatus: (message) =>
    set((state) => ({
      processing: {
        ...state.processing,
        statusLog: [
          ...state.processing.statusLog,
          `[${new Date().toLocaleTimeString()}] ${message}`,
        ],
      },
    })),

  // --- results slice actions ---
  setResults: (updater) => set((state) => ({ results: applyPatch(state.results, updater) })),

  // --- filterResults slice actions ---
  setFilterResults: (updater) =>
    set((state) => ({ filterResults: applyPatch(state.filterResults, updater) })),

  // --- processingTiming slice actions ---
  setProcessingTiming: (updater) =>
    set((state) => ({ processingTiming: applyPatch(state.processingTiming, updater) })),

  // --- testState slice actions ---
  setTestState: (updater) => set((state) => ({ testState: applyPatch(state.testState, updater) })),

  // --- notebookLM slice actions (per-field to mirror current useState shape) ---
  setPodcastDuration: (value) =>
    set((state) => ({ notebookLM: { ...state.notebookLM, podcastDuration: value } })),
  setNotebookLMModel: (value) =>
    set((state) => ({ notebookLM: { ...state.notebookLM, notebookLMModel: value } })),
  setNotebookLMStatus: (value) =>
    set((state) => ({ notebookLM: { ...state.notebookLM, notebookLMStatus: value } })),
  setNotebookLMContent: (value) =>
    set((state) => ({ notebookLM: { ...state.notebookLM, notebookLMContent: value } })),
  setNotebookLMGenerating: (value) =>
    set((state) => ({ notebookLM: { ...state.notebookLM, notebookLMGenerating: value } })),
  setEnableHallucinationCheck: (value) =>
    set((state) => ({
      notebookLM: { ...state.notebookLM, enableHallucinationCheck: value },
    })),
  setHallucinationWarning: (value) =>
    set((state) => ({ notebookLM: { ...state.notebookLM, hallucinationWarning: value } })),

  // --- briefingUI slice actions ---
  setSynthesizing: (value) =>
    set((state) => ({ briefingUI: { ...state.briefingUI, synthesizing: value } })),
  setSynthesisError: (value) =>
    set((state) => ({ briefingUI: { ...state.briefingUI, synthesisError: value } })),
  setBriefingCheckResult: (value) =>
    set((state) => ({ briefingUI: { ...state.briefingUI, briefingCheckResult: value } })),
  setBriefingStage: (value) =>
    set((state) => ({ briefingUI: { ...state.briefingUI, briefingStage: value } })),
  setQuickSummariesById: (value) =>
    set((state) => ({ briefingUI: { ...state.briefingUI, quickSummariesById: value } })),
  setFullReportsById: (value) =>
    set((state) => ({ briefingUI: { ...state.briefingUI, fullReportsById: value } })),

  // --- auth slice actions ---
  setPassword: (value) => set({ password: value }),
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),

  // --- reactContext slice actions ---
  setReactContext: (updater) =>
    set((state) => ({ reactContext: applyPatch(state.reactContext, updater) })),

  // --- reset (primarily for tests) ---
  // Explicit reset action. Calling set() with an object shallow-merges
  // the data keys, preserving action identities — so the store is
  // restored to pristine data values without losing any setters.
  // Tests should call this in beforeEach rather than setState(initialState())
  // directly, so test isolation isn't load-bearing on the structural
  // coincidence that initialState() happens to cover every top-level key.
  resetStore: () => set(initialState()),
}));
