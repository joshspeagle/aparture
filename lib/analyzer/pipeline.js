// Analysis pipeline for ArxivAnalyzer.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F4b); stage bodies
// split into lib/analyzer/stages/*.js (2026-07).
//
// createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef })
// is the composition point: it creates the per-run refs and shared core
// helpers ONCE, then wires them into each stage factory via a single deps
// object so abort/pause/skip-gates semantics stay single-instance. Each
// stage handler reads current state from the Zustand store via
// useAnalyzerStore.getState() at call time. React-hook-derived values
// (profile, currentBriefing, feedback) live in the store's reactContext
// slice, published by a useEffect in ArxivAnalyzer. The three React refs are
// passed as closure args because refs are mutable objects that don't belong
// in the store.

import { MockAPITester } from './mockApi.js';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import { localDateStr } from '../dates.js';
import { MODEL_REGISTRY } from '../../utils/models.js';
import { notesForScope } from '../profile/editorialNotes.js';
import { resolvePodcastLength } from '../notebooklm/podcastLength.js';
import { createPipelineCore } from './stages/core.js';
import { createFetchPapers } from './stages/fetchPapers.js';
import { createPerformQuickFilter } from './stages/quickFilter.js';
import { createScoreAbstracts } from './stages/scoreAbstracts.js';
import { createPostProcessScores } from './stages/postProcessScores.js';
import { createAnalyzePDFs } from './stages/analyzePDFs.js';
import { createStartProcessing, RUN_OUTCOME } from './stages/startProcessing.js';

export function createAnalysisPipeline({ abortControllerRef, pauseRef, mockAPITesterRef }) {
  const store = () => useAnalyzerStore.getState();

  // Captured once at startProcessing entry to prevent cross-midnight drift on long runs.
  const runBriefingDateRef = { current: null };

  const skipRemainingGatesRef = { current: false };

  const { recordUsage, waitForResume, makeRobustAPICall, makeMockRobustAPICall, resetWarmupGate } =
    createPipelineCore({ store, abortControllerRef, pauseRef });

  // One shared deps object per pipeline instance: every stage factory
  // receives the SAME refs and core helpers, preserving single-instance
  // semantics for abort/pause/skip-gates state.
  const deps = {
    store,
    abortControllerRef,
    pauseRef,
    mockAPITesterRef,
    runBriefingDateRef,
    skipRemainingGatesRef,
    waitForResume,
    recordUsage,
    resetWarmupGate,
    makeRobustAPICall,
    makeMockRobustAPICall,
  };

  const fetchPapers = createFetchPapers(deps);
  const performQuickFilter = createPerformQuickFilter(deps);
  const scoreAbstracts = createScoreAbstracts(deps);
  const postProcessScores = createPostProcessScores(deps);
  const analyzePDFs = createAnalyzePDFs(deps);
  const startProcessing = createStartProcessing({
    ...deps,
    fetchPapers,
    performQuickFilter,
    scoreAbstracts,
    postProcessScores,
    analyzePDFs,
  });

  // The test wrappers mirror startProcessing's reentry guard up front, so a
  // click while a run is in flight can't flip the in-flight run's testState
  // flags (startProcessing would only refuse after they were set).
  const runDryRunTest = async () => {
    const { addError, addStatus, setTestState } = store();
    if (store().processing?.isRunning) {
      console.warn('[pipeline] dry run ignored — a run is already in progress');
      return;
    }
    setTestState((prev) => ({ ...prev, dryRunInProgress: true }));

    try {
      // Reset mock API tester to enhanced version
      mockAPITesterRef.current = new MockAPITester({ abortControllerRef, pauseRef, waitForResume });
      addStatus('Starting dry run test - no API costs incurred');

      const outcome = await startProcessing(true, false); // isDryRun = true, useTestPapers = false

      // Stopped: a newer run may own the store (superseded) — then say
      // nothing on this run's behalf; otherwise report the cancel, not a
      // "completed successfully".
      if (outcome === RUN_OUTCOME.SUPERSEDED || outcome === RUN_OUTCOME.IGNORED) return;
      if (outcome === RUN_OUTCOME.ABORTED) {
        addStatus('Dry run test was cancelled');
        setTestState((prev) => ({ ...prev, dryRunInProgress: false }));
        return;
      }

      setTestState((prev) => ({
        ...prev,
        dryRunCompleted: true,
        lastDryRunTime: new Date(),
        dryRunInProgress: false,
      }));

      addStatus('Dry run test completed successfully — click Download Report to save.');
    } catch (error) {
      if (error.message === 'Operation aborted') {
        addStatus('Dry run test was cancelled');
      } else {
        addError(`Dry run test failed: ${error.message}`);
      }
      setTestState((prev) => ({ ...prev, dryRunInProgress: false }));
    }
  };

  const runMinimalTest = async () => {
    const { addError, addStatus, setTestState } = store();
    if (store().processing?.isRunning) {
      console.warn('[pipeline] minimal test ignored — a run is already in progress');
      return;
    }
    setTestState((prev) => ({ ...prev, minimalTestInProgress: true }));

    try {
      addStatus('Starting minimal test with real API calls');

      const outcome = await startProcessing(false, true); // isDryRun = false, useTestPapers = true

      if (outcome === RUN_OUTCOME.SUPERSEDED || outcome === RUN_OUTCOME.IGNORED) return;
      if (outcome === RUN_OUTCOME.ABORTED) {
        addStatus('Minimal test was cancelled');
        setTestState((prev) => ({ ...prev, minimalTestInProgress: false }));
        return;
      }

      setTestState((prev) => ({
        ...prev,
        lastMinimalTestTime: new Date(),
        minimalTestInProgress: false,
      }));

      addStatus('Minimal test completed successfully — click Download Report to save.');
    } catch (error) {
      if (error.message === 'Operation aborted') {
        addStatus('Minimal test was cancelled');
      } else {
        addError(`Minimal test failed: ${error.message}`);
      }
      setTestState((prev) => ({ ...prev, minimalTestInProgress: false }));
    }
  };

  const generateNotebookLM = async () => {
    const {
      results,
      testState,
      password,
      setNotebookLMContent,
      setNotebookLMGenerating,
      setNotebookLMStatus,
    } = store();
    const { podcastDuration, notebookLMModel } = store().notebookLM;
    const { currentBriefing, profile } = store().reactContext;
    try {
      setNotebookLMGenerating(true);
      setNotebookLMStatus('Building the podcast bundle…');
      setNotebookLMContent(null);

      // Combine scored papers and final ranking
      const allPapers =
        results.finalRanking && results.finalRanking.length > 0
          ? results.finalRanking
          : results.scoredPapers.filter((p) => p.score > 0 || p.relevanceScore > 0);

      if (allPapers.length === 0) {
        setNotebookLMStatus('No papers available for a podcast bundle');
        setNotebookLMGenerating(false);
        return;
      }

      // Use mock API if in test mode
      if (testState.dryRunInProgress && mockAPITesterRef.current) {
        console.log('Using mock podcast bundle API...');
        const markdown = await mockAPITesterRef.current.mockGenerateNotebookLM(
          allPapers,
          podcastDuration,
          notebookLMModel
        );
        setNotebookLMContent(markdown);
        setNotebookLMStatus('Podcast bundle generated (mock)');
        return;
      }

      // LOCAL calendar day — matches the briefing date convention
      // (lib/dates.js) so the downloaded bundle is named for the user's day.
      const date = localDateStr();
      const response = await fetch('/api/generate-notebooklm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefing: currentBriefing?.briefing ?? null,
          papers: results.finalRanking,
          podcastDuration: resolvePodcastLength(podcastDuration),
          // Podcast-scoped editorial notes go into the focus prompt.
          podcastNotes: notesForScope(profile?.notes, 'podcast').map((n) => n.text),
          notebookLMModel,
          provider: (MODEL_REGISTRY[notebookLMModel]?.provider ?? 'Google').toLowerCase(),
          password,
          date,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error ?? 'bundle generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aparture-notebooklm-${date}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNotebookLMContent('Podcast bundle downloaded.');
      setNotebookLMStatus('Bundle ready — see download.');
    } catch (error) {
      console.error('Podcast bundle error:', error);
      setNotebookLMStatus(`Error: ${error.message}`);
    } finally {
      setNotebookLMGenerating(false);
    }
  };

  const skipRemainingGates = () => {
    skipRemainingGatesRef.current = true;
    pauseRef.current = false;
    store().addStatus('Skipping remaining review gates for this run');
  };

  return {
    startProcessing,
    runDryRunTest,
    runMinimalTest,
    generateNotebookLM,
    skipRemainingGates,
  };
}
