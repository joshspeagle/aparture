import { useMemo, useState } from 'react';
import FeedbackItem from './FeedbackItem.jsx';
import { feedbackStatus, isPendingFeedback } from '../../lib/profile/feedbackStatus.js';

export function filterEvents(events, filters, { now = Date.now(), cutoff = 0 } = {}) {
  return events.filter((e) => {
    if (filters.newOnly && !isPendingFeedback(e, cutoff)) return false;
    if (filters.type === 'stars' && e.type !== 'star') return false;
    if (filters.type === 'dismisses' && e.type !== 'dismiss') return false;
    if (filters.type === 'comments' && !['paper-comment', 'general-comment'].includes(e.type))
      return false;
    if (filters.type === 'overrides' && e.type !== 'filter-override') return false;
    if (filters.type === 'scoped' && e.type !== 'scoped-feedback') return false;
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

const GROUP_LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--aparture-mute)',
  marginBottom: '4px',
};

const LINK_BUTTON_STYLE = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  color: 'var(--aparture-mute)',
  textDecoration: 'underline',
};

function renderGroups(groups, actions = {}) {
  return groups.map((group) => (
    <div key={group.key}>
      {group.events.map((e) => (
        <FeedbackItem
          key={e.id}
          event={e}
          onRemove={actions.onRemoveEvent}
          onUpdateText={actions.onUpdateEventText}
        />
      ))}
    </div>
  ));
}

// Feedback recorded during a Dry Run / Minimal Test (or legacy dry-run junk
// such as "filter said 123" overrides). Never sent to suggestions, so it is
// collapsed by default and can be cleared in one click.
function TestFeedbackGroup({ events, onClear, actions }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-testid="test-feedback-group"
      style={{
        paddingTop: 'var(--aparture-space-3)',
        borderTop: '1px dashed var(--aparture-hairline)',
        marginTop: 'var(--aparture-space-3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--aparture-space-3)',
          flexWrap: 'wrap',
        }}
      >
        <p style={{ ...GROUP_LABEL_STYLE, marginBottom: 0 }}>
          From test runs ({events.length}) · not used for suggestions
        </p>
        <div style={{ display: 'flex', gap: 'var(--aparture-space-3)' }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={LINK_BUTTON_STYLE}
          >
            {open ? 'Hide' : 'Show'}
          </button>
          {onClear && (
            <button type="button" onClick={onClear} style={LINK_BUTTON_STYLE}>
              Clear test feedback
            </button>
          )}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: '4px' }}>{renderGroups(groupByPaper(events), actions)}</div>
      )}
    </div>
  );
}

export default function FeedbackTimeline({
  events,
  filters,
  cutoff,
  onClearTestEvents,
  onRemoveEvent,
  onUpdateEventText,
}) {
  const actions = { onRemoveEvent, onUpdateEventText };
  const filtered = useMemo(
    () => filterEvents(events, filters, { cutoff }),
    [events, filters, cutoff]
  );

  const byStatus = useMemo(() => {
    const out = { pending: [], incorporated: [], test: [] };
    for (const e of filtered) out[feedbackStatus(e, cutoff)].push(e);
    return out;
  }, [filtered, cutoff]);

  if (filtered.length === 0) {
    return null;
  }

  const newGroups = groupByPaper(byStatus.pending);
  const oldGroups = groupByPaper(byStatus.incorporated);

  // "Pending" is not "newer than the last revision": an older event the user
  // unticked, or one behind a change they rejected, is still pending.
  return (
    <div>
      {newGroups.length > 0 && (
        <div>
          {(oldGroups.length > 0 || byStatus.test.length > 0) && (
            <p style={GROUP_LABEL_STYLE}>Not yet incorporated</p>
          )}
          {renderGroups(newGroups, actions)}
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
        >
          <p style={GROUP_LABEL_STYLE}>Incorporated into your profile</p>
          {renderGroups(oldGroups, actions)}
        </div>
      )}
      {byStatus.test.length > 0 && (
        <TestFeedbackGroup events={byStatus.test} onClear={onClearTestEvents} actions={actions} />
      )}
    </div>
  );
}
