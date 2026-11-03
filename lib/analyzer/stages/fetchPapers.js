// Stage 1: fetch papers from arXiv (harvest + dedupe pass).
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.
// Reads all state from store()/store().reactContext at call time.

import { harvest } from '../../arxiv/ingest.js';
import { buildHarvestWindow } from '../../arxiv/window.js';
import { applyDedupe } from '../applyDedupe.js';
import { abortError, isAbortError, throwIfAborted } from '../../abort.js';

export function createFetchPapers(deps) {
  const { store, abortControllerRef, pauseRef, waitForResume } = deps;

  // `signal` is the run's AbortSignal, captured once (see quickFilter.js).
  const fetchPapers = async ({ signal } = {}) => {
    const runSignal = signal ?? abortControllerRef.current?.signal ?? { aborted: false };
    const {
      addError,
      addStatus,
      resetFilterResults,
      resetResults,
      setProcessing,
      setResults,
      password,
    } = store();
    const { config } = store().reactContext;

    setProcessing((prev) => ({ ...prev, stage: 'fetching', progress: { current: 0, total: 0 } }));

    try {
      const window = buildHarvestWindow(config);
      const { selectedSubcategories } = window;
      if (selectedSubcategories.length === 0) {
        throw new Error('No categories selected');
      }

      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: 0, total: selectedSubcategories.length },
      }));

      const result = await harvest(window, {
        password,
        abortSignal: runSignal,
        statusCallback: (msg) => addStatus(msg),
        progressCallback: (current, total) =>
          setProcessing((prev) => ({ ...prev, stage: 'fetching', progress: { current, total } })),
        waitForResume: async () => {
          if (pauseRef.current) await waitForResume(runSignal);
        },
      });
      // Nothing below may run for a stopped run: it would wipe the previous
      // run's results (resetResults) and hand papers to the billed stages.
      throwIfAborted(runSignal);

      if (result.papers.length === 0) {
        addError(
          `No papers found for any category in the specified time range. Try increasing 'Days to Look Back' or check if categories are valid.`
        );
      }

      // Run-summary status: ingestion mode + paper count + fill-up + cache hits.
      const cacheHits = result.perPrefix.filter((p) => p.cached).length;
      const fillupCount = result.fillups.length;
      const summaryParts = [`arXiv: ${result.modeUsed}`, `${result.papers.length} papers`];
      if (fillupCount > 0) {
        summaryParts.push(`${fillupCount} fill-up${fillupCount > 1 ? 's' : ''}`);
      }
      if (cacheHits > 0) {
        summaryParts.push(`${cacheHits} cache hit${cacheHits > 1 ? 's' : ''}`);
      }

      // Dedupe pass — drop or flag papers already seen in past runs (90-day
      // rolling window, maintained by useSeenPapers). Runs AFTER harvest()
      // completes (and after any fill-up steps inside harvest) rather than
      // before, by design: it keeps this stage's surface small and avoids
      // restructuring lib/arxiv/ingest.js. Tradeoff: a subcategory that hit
      // its minPapersPerSubcategory threshold organically with mostly-
      // duplicate papers won't trigger an extra fill-up, since fill-up has
      // already finished by the time we get here. Index is
      // published to reactContext by App.jsx; missing index (migration in
      // flight) degrades to a no-op with a status-line hint.
      const seenIndex = store().reactContext.seenPapersIndex ?? {};
      const seenReady = store().reactContext.seenPapersReady ?? false;
      const removeDuplicates = config.removeDuplicates ?? true;
      const dedupe = applyDedupe(result.papers, seenIndex, removeDuplicates);
      if (dedupe.matched > 0) {
        const verb = dedupe.mode === 'remove' ? 'removed' : 'flagged';
        summaryParts.push(`${verb} ${dedupe.matched} duplicate${dedupe.matched > 1 ? 's' : ''}`);
      } else if (!seenReady) {
        summaryParts.push('seen-papers index still loading');
      }

      addStatus(summaryParts.join(' · '));

      // First success point where new-run data lands: full slice replacement
      // drops the previous run's results and its run-added keys
      // (availablePapers, failedPapers, allAnalyzedPapers). Deliberately NOT
      // done at run-start — a run that dies during the fetch above must leave
      // the previous run's results intact (setResults' merge semantics never
      // remove keys, so only this replacement can clear the stale ones). The
      // filter buckets are reset here too, for the same reason.
      resetResults();
      resetFilterResults();
      setResults((prev) => ({ ...prev, allPapers: dedupe.kept }));
      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: selectedSubcategories.length, total: selectedSubcategories.length },
      }));

      return dedupe.kept;
    } catch (error) {
      // Stop is not a fetch failure: no error banner, just unwind.
      if (isAbortError(error) || runSignal.aborted) throw abortError();
      addError(`Failed to fetch papers: ${error.message}`);
      throw error;
    }
  };

  return fetchPapers;
}
