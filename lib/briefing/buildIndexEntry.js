// Pure helper: derive the search-capable index subset of a full briefing entry.
// The index omits heavy fields (pipelineArchive, quickSummariesById,
// fullReportsById) and drops render-only briefing fields (themes, onelinePitch,
// whyMatters) that don't participate in sidebar list rendering or archive search.
// Consumers (filterBriefings, SidebarBriefingList) read only executiveSummary +
// papers[{arxivId, title, score}] from history.
//
// `testRun: true` marks a dry-run or minimal-test briefing, so the hot index
// can trim those before any real briefing (hooks/useBriefing.js). Idempotent:
// re-deriving from an index entry (which carries no generationMetadata)
// keeps the flag.

export function isTestRunEntry(entry) {
  return (
    entry?.testRun === true ||
    entry?.generationMetadata?.testMode === true ||
    entry?.generationMetadata?.minimalTest === true
  );
}

export function buildIndexEntry(entry) {
  return {
    id: entry.id,
    date: entry.date,
    timestamp: entry.timestamp,
    archived: entry.archived,
    ...(isTestRunEntry(entry) ? { testRun: true } : {}),
    briefing: {
      executiveSummary: entry.briefing?.executiveSummary ?? '',
      papers: (entry.briefing?.papers ?? []).map((p) => ({
        arxivId: p.arxivId,
        title: p.title,
        score: p.score,
      })),
    },
  };
}
