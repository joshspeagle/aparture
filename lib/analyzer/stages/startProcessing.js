// Pipeline orchestrator: runs Stage 1 fetch through briefing generation,
// including the three review gates (filter-review, score-review,
// pre-briefing-review). Extracted from lib/analyzer/pipeline.js as part of
// the stages/ split. Reads all state from store()/store().reactContext at
// call time; the stage functions arrive pre-bound via the deps object so
// they share the same refs and core helpers.

import { TEST_PAPERS } from '../../../utils/testUtils.js';
import { localDateStr } from '../../dates.js';
import { buildGenerationMetadata } from '../generationMetadata.js';
import { resolveAdditiveSet } from '../resolveAdditiveSet.js';

export function createStartProcessing(deps) {
  const {
    store,
    abortControllerRef,
    pauseRef,
    mockAPITesterRef,
    runBriefingDateRef,
    skipRemainingGatesRef,
    waitForResume,
    recordUsage,
    fetchPapers,
    performQuickFilter,
    scoreAbstracts,
    postProcessScores,
    analyzePDFs,
  } = deps;

  const startProcessing = async (isDryRun = false, useTestPapers = false) => {
    const {
      addError,
      clearSkippedDueToRecaptcha,
      processing,
      resetResults,
      setFilterResults,
      setProcessing,
      setProcessingTiming,
      setResults,
    } = store();
    // Reentry guard: a second concurrent startProcessing would share
    // filterResults state with the first, so every paper would get pushed
    // to the buckets twice (with independent LLM responses). Zustand updates
    // are synchronous, so checking + flipping `isRunning` in the same JS
    // microtask is safe against same-turn double-fires.
    if (processing?.isRunning) {
      console.warn('[pipeline] startProcessing ignored — a run is already in progress');
      return;
    }
    const { config } = store().reactContext;
    const startTime = new Date();
    setProcessingTiming({ startTime, endTime: null, duration: null });
    setProcessing((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      errors: [],
      statusLog: [],
    }));

    // Reset Playwright-skip aggregation on every new run so the end-of-run
    // summary card reflects only the current run.
    clearSkippedDueToRecaptcha();

    // Reset per-stage token-usage accumulation so the end-of-run cost line
    // reflects only the current run.
    store().resetCostTracking();

    // NOTE: resetResults() deliberately does NOT run here. Wiping results at
    // run-start would destroy the previous run's data (hot tier included, via
    // the debounced save) even when this run dies during Stage 1 fetch. The
    // reset instead happens at the first success point where new-run data
    // lands: fetchPapers (just before its allPapers write) and the
    // useTestPapers branch below. Cheap UI state (cost tracking, reCAPTCHA
    // skips, MS selections) still clears at run-start above/below.

    // Reset filter results for new processing
    setFilterResults({
      total: 0,
      yes: [],
      maybe: [],
      no: [],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
    });

    pauseRef.current = false;
    skipRemainingGatesRef.current = false;
    abortControllerRef.current = new AbortController();

    // Capture run date once so filter-override events and other per-run
    // metadata use a consistent date even on long overnight runs. LOCAL
    // calendar day — must match the briefing date briefingClient stamps and
    // the todayScopedEvents filter in App.jsx (see lib/dates.js).
    runBriefingDateRef.current = localDateStr();

    // Clear MS star/dismiss selections from any prior run.
    store().msClear();

    let finalPapers = []; // Track final papers locally

    try {
      let papers;

      if (useTestPapers) {
        // Use hardcoded test papers for minimal test
        setProcessing((prev) => ({ ...prev, stage: 'fetching' }));
        papers = TEST_PAPERS;
        // First success point where new-run data lands: full slice
        // replacement drops the previous run's results and its run-added
        // keys (availablePapers, failedPapers, allAnalyzedPapers) — see the
        // run-start note above for why this doesn't happen earlier.
        resetResults();
        setResults((prev) => ({ ...prev, allPapers: papers }));
      } else {
        // Stage 1: Fetch papers from arXiv
        papers = await fetchPapers();
        if (papers.length === 0) {
          addError('No papers found for specified categories');
          return;
        }
      }

      // Stage 2: Quick filter (if enabled)
      let papersToScore = papers;
      if (config.useQuickFilter) {
        papersToScore = await performQuickFilter(papers, isDryRun);

        if (papersToScore.length === 0) {
          addError(
            'No papers passed the initial filter. Consider adjusting filter criteria or categories.'
          );
          return;
        }

        console.log(`\n=== FILTER COMPLETE ===`);
        console.log(
          `Papers proceeding to scoring: ${papersToScore.length} of ${papers.length} (${Math.round((papersToScore.length / papers.length) * 100)}%)`
        );

        // Phase B: pauseAfterFilter gate. When enabled, the pipeline halts
        // here so the user can review filter results and apply overrides via
        // the ProgressTimeline's interactive UI. The UI sets pauseRef.current
        // = true when it detects the 'filter-review' stage, and the user
        // clicks "Continue to scoring →" which sets it back to false.
        if (config.pauseAfterFilter && !skipRemainingGatesRef.current) {
          setProcessing((prev) => ({ ...prev, stage: 'filter-review' }));
          pauseRef.current = true;
          await waitForResume();
          // Re-read the buckets (user overrides during the pause) AND the
          // fresh config, then rebuild papersToScore by conditionally
          // including each bucket based on membership in categoriesToScore —
          // exactly mirroring the pre-gate path. Hardcoding YES-always /
          // NO-never here would silently drop NO-selected papers and ignore
          // a MAYBE-only selection.
          const freshStore = store();
          const categoriesToScore = freshStore.reactContext.config?.categoriesToScore ?? [
            'YES',
            'MAYBE',
          ];
          papersToScore = [
            ...(categoriesToScore.includes('YES') ? freshStore.filterResults.yes : []),
            ...(categoriesToScore.includes('MAYBE') ? freshStore.filterResults.maybe : []),
            ...(categoriesToScore.includes('NO') ? freshStore.filterResults.no : []),
          ];
        }
      }

      // Stage 3: Score abstracts (now returns only successfully scored papers)
      const scoredPapers = await scoreAbstracts(papersToScore, isDryRun);

      if (scoredPapers.length === 0) {
        addError(
          'No papers could be scored successfully. Check your API configuration and try again.'
        );
        return;
      }

      // Stage 3.5: Post-process scores for consistency (optional)
      let postProcessedPapers = scoredPapers;
      if (config.enableScorePostProcessing) {
        postProcessedPapers = await postProcessScores(scoredPapers, isDryRun);
      }

      // Stage 4: Select top papers for deep analysis (now working with filtered, sorted, and optionally post-processed papers)
      setProcessing((prev) => ({ ...prev, stage: 'selecting' }));

      // Hoist eligibility filter before the gate — UI candidate list is availablePapers (no failed-to-score papers visible).
      // availablePapers is already score-sorted: scoreAbstracts returns a sorted array (see pipeline.js ~line 954)
      // and postProcessScores re-sorts its output (see pipeline.js ~line 1202). Filter preserves that order.
      // resolveAdditiveSet's top-N slice therefore operates on score-ranked input without an extra sort here.
      const availablePapers = postProcessedPapers.filter(
        (paper) =>
          paper.relevanceScore > 0 && paper.scoreJustification !== 'Failed to score after retries'
      );

      if (availablePapers.length === 0) {
        addError(
          'No papers qualified for deep analysis. All papers either failed to score or had zero relevance.'
        );
        return;
      }

      // Expose availablePapers to the score-review UI BEFORE the gate
      setResults((prev) => ({ ...prev, scoredPapers: postProcessedPapers, availablePapers }));

      // MS gate: pause for user to review which papers go to PDF analysis
      const latestConfig = store().reactContext.config;
      if (latestConfig.pauseBeforeDeepAnalysis && !skipRemainingGatesRef.current) {
        store().addStatus(`Score review: ${availablePapers.length} papers awaiting selection`);
        setProcessing((prev) => ({ ...prev, stage: 'score-review' }));
        pauseRef.current = true;
        await waitForResume();
      }

      // Resolve the additive PDF set after the gate. maxDeepAnalysis comes
      // from the fresh store config (not the run-start closure snapshot) so
      // a settings change made during the gate pause takes effect.
      const freshStore = store();
      const topPapers = resolveAdditiveSet({
        availablePapers,
        maxDeepAnalysis: freshStore.reactContext.config?.maxDeepAnalysis ?? config.maxDeepAnalysis,
        starredIds: freshStore.msStarredIds,
        dismissedIds: freshStore.msDismissedIds,
      });

      if (topPapers.length === 0) {
        addError(
          'All papers dismissed at score review — star at least one paper or continue without dismissing all.'
        );
        return;
      }

      console.log(`\n=== SELECTION SUMMARY ===`);
      console.log(`Available papers for deep analysis: ${availablePapers.length}`);
      console.log(`Selected for deep analysis: ${topPapers.length}`);

      store().addStatus(
        `Score review complete: ${topPapers.length} papers selected for PDF analysis`
      );
      // fromDryRun is the run-origin signal for the manual Generate Briefing
      // button: it must know whether the results it would synthesize over are
      // mock (dry-run) data AFTER the run ends, when testState.dryRunInProgress
      // has already flipped back to false. Stamped on every finalRanking write.
      setResults((prev) => ({ ...prev, finalRanking: topPapers, fromDryRun: isDryRun }));
      const analyzedPapers = await analyzePDFs(topPapers, isDryRun);

      // Stage 6: Final ranking and output
      setProcessing((prev) => ({ ...prev, stage: 'complete' }));

      // Sort by final score (or relevance score as fallback)
      analyzedPapers.sort((a, b) => {
        const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
        const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
        return scoreB - scoreA;
      });

      // Re-read finalOutputCount from the fresh store config (not the
      // run-start closure snapshot) so changes made at the gates apply.
      const msStarredIds = store().msStarredIds;
      const finalOutputCount =
        store().reactContext.config?.finalOutputCount ?? config.finalOutputCount;
      const topByScore = analyzedPapers.slice(0, finalOutputCount);
      const topByScoreIds = new Set(topByScore.map((p) => p.id ?? p.arxivId));
      const guaranteedMSStarred = analyzedPapers.filter((p) => {
        const id = p.id ?? p.arxivId;
        return msStarredIds.has(id) && !topByScoreIds.has(id);
      });
      finalPapers = [...topByScore, ...guaranteedMSStarred];
      finalPapers.sort(
        (a, b) => (b.finalScore ?? b.relevanceScore ?? 0) - (a.finalScore ?? a.relevanceScore ?? 0)
      );

      // Expose the full analyzed set so the pre-briefing expander UI (Phase 4)
      // can render cut papers without re-fetching.
      setResults((prev) => ({
        ...prev,
        allAnalyzedPapers: analyzedPapers,
        finalRanking: finalPapers,
        fromDryRun: isDryRun,
      }));

      // Stage 7: Briefing generation (auto-runs at end of pipeline)
      if (finalPapers.length > 0) {
        const { config: latestConfig } = store().reactContext;

        if (latestConfig?.pauseBeforeBriefing && !skipRemainingGatesRef.current) {
          // Pause so user can review results + add feedback before briefing
          setProcessing((prev) => ({ ...prev, stage: 'pre-briefing-review' }));
          pauseRef.current = true;
          await waitForResume();

          // Re-read finalRanking from the store in case the user promoted papers
          // from the "show N more analyzed" expander.
          const briefingGateStore = store();
          finalPapers = briefingGateStore.results.finalRanking ?? finalPapers;
        }

        // Generate the briefing
        setProcessing((prev) => ({ ...prev, stage: 'synthesizing' }));

        // Read the latest state for briefing generation
        const briefingStore = store();
        const briefingCtx = briefingStore.reactContext;

        // Build generation metadata via the shared builder (same fields the
        // manual Generate Briefing path persists — see generationMetadata.js).
        const generationMetadata = buildGenerationMetadata({
          config: latestConfig,
          profile: briefingCtx.profile,
          filterResults: briefingStore.filterResults,
          papersScreened: briefingStore.results.allPapers?.length ?? 0,
          testMode: isDryRun,
        });
        const resolvedBriefingModel = generationMetadata.briefingModel;

        try {
          const { runBriefingGeneration } = await import('../briefingClient.js');
          await runBriefingGeneration({
            // scoredPapers rides along so the briefing's pipelineArchive
            // captures the adjustment trail, not just the final ranking.
            results: {
              finalRanking: finalPapers,
              scoredPapers: briefingStore.results.scoredPapers ?? [],
            },
            briefingModel: resolvedBriefingModel,
            pdfModel: latestConfig?.pdfModel,
            quickSummaryModel: latestConfig?.quickSummaryModel,
            quickSummaryConcurrency: latestConfig?.quickSummaryConcurrency,
            briefingRetryOnYes: latestConfig?.briefingRetryOnYes ?? true,
            briefingRetryOnMaybe: latestConfig?.briefingRetryOnMaybe ?? false,
            profile: briefingCtx.profile,
            password: briefingStore.password,
            feedbackEvents: briefingCtx.feedback?.events ?? [],
            filterResults: briefingStore.filterResults,
            saveBriefing: briefingCtx.saveBriefing,
            generationMetadata,
            setSynthesizing: briefingStore.setSynthesizing,
            setSynthesisError: briefingStore.setSynthesisError,
            setBriefingCheckResult: briefingStore.setBriefingCheckResult,
            setBriefingStage: briefingStore.setBriefingStage,
            setQuickSummariesById: briefingStore.setQuickSummariesById,
            setFullReportsById: briefingStore.setFullReportsById,
            addStatus: briefingStore.addStatus,
            // Per-stage token-usage accumulation (quick summaries + briefing).
            onUsage: recordUsage,
            abortSignal: abortControllerRef.current?.signal,
            // Dry runs must never hit the real quick-summary / synthesize /
            // check-briefing routes — they'd 401 on a keyless install and
            // bill the user on a configured one.
            mockTester: isDryRun ? mockAPITesterRef.current : null,
          });
        } catch (briefingErr) {
          // Abort is not a briefing failure — let the outer handler (which
          // suppresses 'Operation aborted') deal with it.
          if (briefingErr.message === 'Operation aborted') throw briefingErr;
          addError(`Briefing generation failed: ${briefingErr.message}`);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError' && error.message !== 'Operation aborted') {
        addError(`Processing failed: ${error.message}`);
      }
    } finally {
      const endTime = new Date();
      const duration = startTime ? endTime - startTime : 0;
      setProcessingTiming((prev) => ({
        ...prev,
        startTime: prev.startTime || startTime,
        endTime,
        duration,
      }));

      // Defensively clear the filter-progress flag so an abort/stop that
      // interrupts the run can never leave "Processing batch X of Y"
      // rendered after the run has ended. The normal path clears it at the
      // end of performQuickFilter; this covers every other exit.
      setFilterResults((prev) => ({ ...prev, inProgress: false }));

      setProcessing((prev) => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        // Use local finalPapers array instead of results.finalRanking
        stage: finalPapers.length > 0 ? 'complete' : 'idle',
      }));
    }
  };

  return startProcessing;
}
