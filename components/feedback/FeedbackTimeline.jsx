import { useMemo } from 'react';
import FeedbackItem from './FeedbackItem.jsx';

export function filterEvents(events, filters, { now = Date.now(), cutoff = 0 } = {}) {
  return events.filter((e) => {
    if (filters.newOnly && e.timestamp <= cutoff) return false;
    if (filters.type === 'stars' && e.type !== 'star') return false;
    if (filters.type === 'dismisses' && e.type !== 'dismiss') return false;
    if (filters.type === 'comments' && !['paper-comment', 'general-comment'].includes(e.type))
      return false;
    if (filters.type === 'overrides' && e.type !== 'filter-override') return false;
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
    <div>
      {newGroups.length > 0 && (
        <div>
          {cutoff > 0 && (
            <p
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--aparture-mute)',
                marginBottom: '4px',
              }}
            >
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
        <div
          style={{
            paddingTop: 'var(--aparture-space-3)',
            borderTop: '1px dashed var(--aparture-hairline)',
            marginTop: 'var(--aparture-space-3)',
            opacity: 0.6,
          }}
          className="border-dashed"
        >
          <p
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--aparture-mute)',
              marginBottom: '4px',
            }}
          >
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
