import { useMemo } from 'react';
import FeedbackItem from './FeedbackItem.jsx';

export function filterEvents(events, filters, { now = Date.now(), cutoff = 0 } = {}) {
  return events.filter((e) => {
    if (filters.newOnly && e.timestamp <= cutoff) return false;
    if (filters.type === 'stars' && e.type !== 'star') return false;
    if (filters.type === 'dismisses' && e.type !== 'dismiss') return false;
    if (filters.type === 'comments' && !['paper-comment', 'general-comment'].includes(e.type))
      return false;
    if (filters.dateRange && filters.dateRange !== 'all') {
      const days = parseInt(filters.dateRange, 10);
      if (Number.isFinite(days)) {
        const dateCutoff = now - days * 86400000;
        if (e.timestamp < dateCutoff) return false;
      }
    }
    return true;
  });
}

export function groupByPaper(events) {
  const groupsMap = new Map();
  for (const e of events) {
    if (e.type === 'general-comment') {
      const key = `general-${e.id}`;
      groupsMap.set(key, { key, kind: 'general', events: [e], newestTs: e.timestamp });
    } else if (e.arxivId) {
      const key = `paper-${e.arxivId}`;
      const existing = groupsMap.get(key);
      if (existing) {
        existing.events.push(e);
        if (e.timestamp > existing.newestTs) existing.newestTs = e.timestamp;
      } else {
        groupsMap.set(key, {
          key,
          kind: 'paper',
          events: [e],
          newestTs: e.timestamp,
        });
      }
    }
  }
  return Array.from(groupsMap.values()).sort((a, b) => b.newestTs - a.newestTs);
}

export default function FeedbackTimeline({ events, filters, cutoff }) {
  const filtered = useMemo(
    () => filterEvents(events, filters, { cutoff }),
    [events, filters, cutoff]
  );

  const newEvents = filtered.filter((e) => e.timestamp > cutoff);
  const oldEvents = filtered.filter((e) => e.timestamp <= cutoff);

  const newGroups = groupByPaper(newEvents);
  const oldGroups = groupByPaper(oldEvents);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {newGroups.length > 0 && (
        <div>
          {cutoff > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              New since last revision
            </p>
          )}
          {newGroups.map((group) => (
            <div key={group.key}>
              {group.events.map((e) => (
                <FeedbackItem key={e.id} event={e} />
              ))}
            </div>
          ))}
        </div>
      )}
      {oldGroups.length > 0 && (
        <div className="pt-3 border-t border-dashed border-slate-700 mt-3 opacity-60">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Already incorporated in previous profile revision
          </p>
          {oldGroups.map((group) => (
            <div key={group.key}>
              {group.events.map((e) => (
                <FeedbackItem key={e.id} event={e} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
