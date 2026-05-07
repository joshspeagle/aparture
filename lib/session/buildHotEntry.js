// Builds the localStorage hot-tier blob for analyzer session state. Heavy
// fields (results.allPapers, results.scoredPapers, full filterResults arrays)
// live in the filesystem cold tier at reports/sessions/<id>.json; the hot
// blob stays under ~600 KB so localStorage quota is never the limit.
//
// Shape preserved for CLI compat (cli/run-analysis.js reads
// appState.results.finalRanking). The full session is fetched lazily on
// mount via GET /api/sessions/<id> when sessionId is present.

export function buildHotEntry({
  config,
  sessionId,
  finalRanking,
  filterResults,
  processingTiming,
  testState,
  podcastDuration,
  notebookLMModel,
  notebookLMContent,
  password,
  isAuthenticated,
}) {
  return {
    config,
    sessionId,
    results: {
      // Drop allPapers + scoredPapers from the hot tier — re-derivable from
      // the cold-tier file and from lib/arxiv/cache.js. Keep finalRanking
      // (top 30 with deepAnalysis, ~300-500 KB) so the post-refresh "view
      // results" path renders without a network roundtrip.
      finalRanking: finalRanking ?? [],
    },
    filterResults: {
      total: filterResults?.total ?? 0,
      yesCount: filterResults?.yes?.length ?? 0,
      maybeCount: filterResults?.maybe?.length ?? 0,
      noCount: filterResults?.no?.length ?? 0,
    },
    processingTiming,
    testState,
    notebookLM: {
      duration: podcastDuration,
      model: notebookLMModel,
      content: notebookLMContent,
    },
    password: isAuthenticated ? password : '',
  };
}

// Builds the full session payload posted to the cold tier. Includes
// allPapers + scoredPapers + full filterResults verdicts so a refresh can
// restore the exact pre-refresh UI state. Spreads `results` so other slice
// fields (e.g. `failedPapers` from scoreAbstracts) survive the round-trip.
export function buildColdEntry({ sessionId, results, filterResults, processingTiming }) {
  return {
    id: sessionId,
    timestamp: Date.now(),
    results: {
      ...(results ?? {}),
      allPapers: results?.allPapers ?? [],
      scoredPapers: results?.scoredPapers ?? [],
      finalRanking: results?.finalRanking ?? [],
    },
    filterResults: {
      total: filterResults?.total ?? 0,
      yes: filterResults?.yes ?? [],
      maybe: filterResults?.maybe ?? [],
      no: filterResults?.no ?? [],
    },
    processingTiming,
  };
}
