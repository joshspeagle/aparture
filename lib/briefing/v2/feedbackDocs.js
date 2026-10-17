// Converts the briefing page's feedback documents (the artifact's `feedback`
// collection, written by lib/briefing/v2/render.js's page script) into
// append-only events for <state>/feedback.jsonl.
//
// The page stores current state per document (a paper is starred or not);
// the log records changes. A cursor holds the last body seen per document,
// so re-ingesting the same documents produces no new events.

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * @param {Array<{id: string, data: Object}>} docs
 * @param {Record<string, Object>} cursor  doc id -> last body ingested
 * @param {string} [nowIso]
 * @returns {{events: Object[], cursor: Record<string, Object>}}
 */
export function docsToEvents(docs, cursor = {}, nowIso = new Date().toISOString()) {
  const events = [];
  const next = { ...cursor };
  for (const { id, data } of docs) {
    if (!data || typeof data !== 'object') continue;
    const prev = cursor[id] ?? {};
    const base = { at: str(data.updatedAt) || nowIso, date: str(data.date), source: 'page' };
    if (!base.date) continue;

    if (data.kind === 'paper') {
      const paper = str(data.id) || str(data.key);
      if (!paper) continue;
      const flip = (field, on, off) => {
        if (Boolean(data[field]) !== Boolean(prev[field])) {
          events.push({ ...base, type: data[field] ? on : off, id: paper });
        }
      };
      flip('star', 'star', 'unstar');
      flip('dismiss', 'dismiss', 'undismiss');
      if (data.knew && !prev.knew) events.push({ ...base, type: 'already-knew', id: paper });
      if (str(data.comment) && str(data.comment) !== str(prev.comment)) {
        events.push({ ...base, type: 'comment', id: paper, text: str(data.comment) });
      }
    } else if (data.kind === 'answer') {
      if (str(data.answer) && str(data.answer) !== str(prev.answer)) {
        events.push({
          ...base,
          type: 'answer',
          question: str(data.question) || str(data.key),
          answer: str(data.answer),
        });
      }
    } else if (data.kind === 'proposal') {
      if (str(data.decision) && str(data.decision) !== str(prev.decision)) {
        events.push({
          ...base,
          type: 'proposal-decision',
          proposal: str(data.proposal) || str(data.key),
          decision: str(data.decision),
        });
      }
    } else if (data.kind === 'general') {
      if (str(data.comment) && str(data.comment) !== str(prev.comment)) {
        events.push({ ...base, type: 'comment', id: null, text: str(data.comment) });
      }
    }
    next[id] = data;
  }
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return { events, cursor: next };
}
