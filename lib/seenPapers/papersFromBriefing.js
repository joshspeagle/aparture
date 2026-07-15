// Pure helper: extract the arxivId set "reachable" from a saved briefing
// entry, normalized to the {id} shape useSeenPapers.recordRun expects.
//
// The dedupe index is briefing-anchored — a paper is "seen" only if it
// appeared in a run that reached briefing-save. We include both:
//   - briefing.papers[].arxivId  — papers the user actually saw in the brief
//   - pipelineArchive.filterResults.{yes,maybe,no}[].id  — everything the
//     LLM filter looked at during that run, so cost-anchoring is preserved
//     across reruns without leaking on aborted runs.
//
// pipelineArchive may be absent (stripped under localStorage quota
// pressure — see HEAVY_FIELDS in hooks/useBriefing.js); when missing the
// briefed papers are the only signal we have.

export function papersFromBriefing(entry) {
  // Dry-run briefings are mock analyses over REAL fetched papers. Feeding
  // them into the dedupe index would silently remove those papers from the
  // user's next real run ("removed N duplicates" on day one). Test-mode
  // entries contribute nothing to the index — both here (live recordRun)
  // and in the useSeenPapers cold-briefing migration, which share this
  // helper.
  if (entry?.generationMetadata?.testMode) return [];

  const ids = new Set();

  const briefedPapers = entry?.briefing?.papers ?? [];
  for (const p of briefedPapers) {
    if (p?.arxivId) ids.add(p.arxivId);
  }

  const filterResults = entry?.pipelineArchive?.filterResults;
  if (filterResults) {
    for (const bucket of ['yes', 'maybe', 'no']) {
      const list = filterResults[bucket] ?? [];
      for (const p of list) {
        if (p?.id) ids.add(p.id);
      }
    }
  }

  return Array.from(ids).map((id) => ({ id }));
}
