// Pure filter utility for briefing archive search.
// Takes briefing history + feedback events and returns briefings that
// match all supplied filters. No React, no side effects.

function matchesDateRange(date, dateRange) {
  if (!dateRange) return true;
  const [start, end] = dateRange;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function matchesStarredOnly(briefingEntry, starredArxivIds) {
  const papers = briefingEntry.briefing?.papers ?? [];
  return papers.some((p) => starredArxivIds.has(p.arxivId));
}

function matchesQuery(briefingEntry, queryLower) {
  const b = briefingEntry.briefing ?? {};
  if (b.executiveSummary && b.executiveSummary.toLowerCase().includes(queryLower)) {
    return true;
  }
  const papers = b.papers ?? [];
  for (const p of papers) {
    if (p.title && p.title.toLowerCase().includes(queryLower)) return true;
  }
  return false;
}

export function filterBriefings(history, feedbackEvents = [], filters = {}) {
  const { dateRange, starredOnly, query } = filters;

  // Precompute starred arxivIds per partition (real vs test-run) once so the
  // filter remains O(n + m) while keeping dry-run stars out of real briefings.
  const realStarredIds = new Set();
  const testStarredIds = new Set();
  if (starredOnly) {
    for (const e of feedbackEvents) {
      if (e.type === 'star' && e.arxivId) {
        (e.testMode ? testStarredIds : realStarredIds).add(e.arxivId);
      }
    }
  }

  const queryLower = query ? query.toLowerCase() : null;

  return history.filter((entry) => {
    if (!matchesDateRange(entry.date, dateRange)) return false;
    if (starredOnly) {
      const isTestEntry = Boolean(entry.testRun ?? entry.generationMetadata?.testMode);
      if (!matchesStarredOnly(entry, isTestEntry ? testStarredIds : realStarredIds)) return false;
    }
    if (queryLower && !matchesQuery(entry, queryLower)) return false;
    return true;
  });
}
