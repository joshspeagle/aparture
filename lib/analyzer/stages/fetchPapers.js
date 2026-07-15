// Stage 1: fetch papers from arXiv (harvest + dedupe pass).
// Extracted from lib/analyzer/pipeline.js as part of the stages/ split.
// Reads all state from store()/store().reactContext at call time.

import { harvest } from '../../arxiv/ingest.js';
import { applyDedupe } from '../applyDedupe.js';

export function createFetchPapers(deps) {
  const { store, abortControllerRef, pauseRef, waitForResume } = deps;

  const fetchPapers = async () => {
    const { addError, addStatus, setProcessing, setResults, password } = store();
    const { config } = store().reactContext;

    setProcessing((prev) => ({ ...prev, stage: 'fetching', progress: { current: 0, total: 0 } }));

    try {
      const selectedSubcategories = (config.selectedCategories ?? []).filter((c) => c.trim());
      if (selectedSubcategories.length === 0) {
        throw new Error('No categories selected');
      }

      // daysBack: N means "N days of content". For submitted-only mode the
      // OAI fetch window is widened backward by ANNOUNCE_LAG_BUFFER_DAYS past
      // the user's target — arXiv's announcement schedule puts day-N
      // submissions in OAI on day N+1, more on weekends. The orchestrator
      // anchors on the most recent v1 day with content and slices the v1
      // target back to N days from there. For submitted-or-updated, the OAI
      // window equals the user's target directly (no anchor; everything in
      // the window is what the user asked for).
      const ANNOUNCE_LAG_BUFFER_DAYS = 7;
      const targetDaysBack = Math.max(1, config.daysBack ?? 1);
      const windowSemantics = config.arxivWindowSemantics ?? 'submitted-only';
      const lagBuffer = windowSemantics === 'submitted-only' ? ANNOUNCE_LAG_BUFFER_DAYS : 0;
      const endDate = new Date();
      endDate.setUTCDate(endDate.getUTCDate() - 1);
      const fetchStart = new Date(endDate);
      fetchStart.setUTCDate(fetchStart.getUTCDate() - (targetDaysBack + lagBuffer - 1));
      const formatDate = (d) => d.toISOString().split('T')[0];

      const window = {
        from: formatDate(fetchStart),
        until: formatDate(endDate),
        targetDaysBack,
        selectedSubcategories,
        fillupSchedule: config.lookbackExtensions ?? [3, 7, 14],
        minPapersPerSubcategory: config.minPapersPerSubcategory ?? 5,
        mode: config.arxivIngestion ?? 'auto',
        windowSemantics,
        cacheTtlMinutes: config.arxivCacheTtlMinutes ?? 60,
      };

      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: 0, total: selectedSubcategories.length },
      }));

      const result = await harvest(window, {
        password,
        abortSignal: abortControllerRef.current?.signal ?? { aborted: false },
        statusCallback: (msg) => addStatus(msg),
        progressCallback: (current, total) =>
          setProcessing((prev) => ({ ...prev, stage: 'fetching', progress: { current, total } })),
        waitForResume: async () => {
          if (pauseRef.current) await waitForResume();
        },
      });

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
      // already finished by the time we get here. See spec §5.4. Index is
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

      setResults((prev) => ({ ...prev, allPapers: dedupe.kept }));
      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: selectedSubcategories.length, total: selectedSubcategories.length },
      }));

      return dedupe.kept;
    } catch (error) {
      addError(`Failed to fetch papers: ${error.message}`);
      throw error;
    }
  };

  return fetchPapers;
}
