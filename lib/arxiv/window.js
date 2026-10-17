// Builds the HarvestWindow for "N days of content" from a run config.
//
// daysBack: N means N days of content, not N calendar days. arXiv announces
// day-N submissions on day N+1 (later across weekends and holidays), so for
// submitted-only semantics the OAI fetch is widened backward by
// ANNOUNCE_LAG_BUFFER_DAYS and ingest.harvest anchors on the most recent v1
// day with content. For submitted-or-updated the OAI window is the target
// window itself.

export const ANNOUNCE_LAG_BUFFER_DAYS = 7;

const formatDate = (d) => d.toISOString().split('T')[0];

/**
 * @param {Object} config  analyzer config (selectedCategories, daysBack, ...)
 * @param {Date} [now]
 * @returns {import('./types.js').HarvestWindow}
 */
export function buildHarvestWindow(config, now = new Date()) {
  const selectedSubcategories = (config.selectedCategories ?? []).filter((c) => c.trim());
  const targetDaysBack = Math.max(1, config.daysBack ?? 1);
  const windowSemantics = config.arxivWindowSemantics ?? 'submitted-only';
  const lagBuffer = windowSemantics === 'submitted-only' ? ANNOUNCE_LAG_BUFFER_DAYS : 0;

  const endDate = new Date(now);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const fetchStart = new Date(endDate);
  fetchStart.setUTCDate(fetchStart.getUTCDate() - (targetDaysBack + lagBuffer - 1));

  return {
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
}
