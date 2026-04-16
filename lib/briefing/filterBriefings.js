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

  // Precompute starred arxivIds once so the filter is O(n + m) not O(n*m).
  // Relies on useFeedback's latest-wins semantics: replaceStarOrDismiss
  // guarantees at most one star/dismiss event per arxivId in the events
  // array, so we don't need to check for a later dismiss overriding an
  // earlier star.
  const starredArxivIds = new Set();
  if (starredOnly) {
    for (const e of feedbackEvents) {
      if (e.type === 'star' && e.arxivId) starredArxivIds.add(e.arxivId);
    }
  }

  const queryLower = query ? query.toLowerCase() : null;

  return history.filter((entry) => {
    if (!matchesDateRange(entry.date, dateRange)) return false;
    if (starredOnly && !matchesStarredOnly(entry, starredArxivIds)) return false;
    if (queryLower && !matchesQuery(entry, queryLower)) return false;
    return true;
  });
}
