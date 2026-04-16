// components/shell/SidebarBriefingList.jsx
// Scrollable list of briefing entries for the sidebar.

import { useMemo, useState } from 'react';
import { filterBriefings } from '../../lib/briefing/filterBriefings.js';
import Input from '../ui/Input.jsx';

/**
 * Build a human-friendly label for a briefing entry.
 * When `showTime` is true (i.e. multiple entries share the same date),
 * a time suffix is appended — e.g. "Today · 2:30 PM".
 */
function formatBriefingLabel(dateStr, timestamp, showTime) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayISO = today.toISOString().slice(0, 10);
  const isToday = dateStr === todayISO;

  let base;
  if (isToday) {
    base = `Today \u00b7 ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else {
    base = `${date.toLocaleDateString('en-US', { weekday: 'short' })} \u00b7 ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  if (showTime && timestamp) {
    const time = new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${base} \u00b7 ${time}`;
  }

  return base;
}

function countStars(briefing, feedbackEvents) {
  if (!briefing?.papers?.length || !feedbackEvents?.length) return 0;
  const starredIds = new Set(feedbackEvents.filter((e) => e.type === 'star').map((e) => e.arxivId));
  return briefing.papers.filter((p) => starredIds.has(p.arxivId)).length;
}

export default function SidebarBriefingList({
  briefingHistory,
  feedbackEvents,
  activeView,
  onSelectView,
  onDeleteBriefing,
  onToggleArchive,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);

  const isSearching = !!(searchQuery || starredOnly);

  const filtered = useMemo(() => {
    if (!briefingHistory?.length) return [];
    // When searching, include archived entries so they're discoverable.
    // Otherwise, filter them out.
    const source = isSearching ? briefingHistory : briefingHistory.filter((b) => !b.archived);
    return filterBriefings(source, feedbackEvents, {
      query: searchQuery || undefined,
      starredOnly: starredOnly || undefined,
    });
  }, [briefingHistory, feedbackEvents, searchQuery, starredOnly, isSearching]);

  // Determine which dates have multiple entries — those need time suffixes.
  const dateCounts = useMemo(() => {
    const counts = {};
    for (const entry of filtered) {
      counts[entry.date] = (counts[entry.date] || 0) + 1;
    }
    return counts;
  }, [filtered]);

  const entries = useMemo(() => {
    return filtered.map((entry) => ({
      id: entry.id,
      date: entry.date,
      label: formatBriefingLabel(entry.date, entry.timestamp, dateCounts[entry.date] > 1),
      starCount: countStars(entry.briefing, feedbackEvents),
      viewId: `briefing:${entry.id}`,
      archived: entry.archived ?? false,
    }));
  }, [filtered, feedbackEvents, dateCounts]);

  const entryStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    color: 'var(--aparture-ink)',
    background: isActive ? 'var(--aparture-sidebar-active)' : 'transparent',
    transition: 'background 100ms ease',
  });

  const actionBtnStyle = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: '13px',
    lineHeight: 1,
    opacity: 0.5,
    transition: 'opacity 150ms ease',
    flexShrink: 0,
  };

  const hasHistory = briefingHistory?.length > 0;

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 var(--aparture-space-2)',
      }}
    >
      {/* Search + starred filter */}
      {hasHistory && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: 'var(--aparture-space-2)',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1 }}>
            <Input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 'var(--aparture-text-xs)',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setStarredOnly((v) => !v)}
            title={starredOnly ? 'Show all briefings' : 'Show only briefings with starred papers'}
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: '14px',
              lineHeight: 1,
              width: '28px',
              height: '28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              border: '1px solid var(--aparture-hairline)',
              background: starredOnly ? 'var(--aparture-accent)' : 'transparent',
              color: starredOnly ? '#fff' : 'var(--aparture-mute)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 150ms ease',
            }}
          >
            {'\u2605'}
          </button>
        </div>
      )}

      {entries.map((entry) => (
        <div
          key={entry.viewId}
          style={entryStyle(activeView === entry.viewId)}
          onClick={() => onSelectView(entry.viewId)}
          onMouseEnter={(e) => {
            if (activeView !== entry.viewId) {
              e.currentTarget.style.background = 'var(--aparture-hover)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              activeView === entry.viewId ? 'var(--aparture-sidebar-active)' : 'transparent';
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectView(entry.viewId);
            }
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.label}
            {entry.archived && (
              <span
                style={{
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                  marginLeft: '4px',
                }}
              >
                (archived)
              </span>
            )}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            {entry.starCount > 0 && (
              <span
                style={{
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  marginRight: '4px',
                }}
              >
                <span style={{ fontSize: '11px' }}>{'\u2605'}</span>
                {entry.starCount}
              </span>
            )}
            {/* Archive / Unarchive button */}
            {onToggleArchive && (
              <button
                type="button"
                title={entry.archived ? 'Unarchive' : 'Archive'}
                style={actionBtnStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleArchive(entry.id);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = 1;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = 0.5;
                }}
              >
                {entry.archived ? '\u{1F4E4}' : '\u{1F4E6}'}
              </button>
            )}
            {/* Delete button */}
            {onDeleteBriefing && (
              <button
                type="button"
                title="Delete briefing"
                style={actionBtnStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  const confirmed = window.confirm(
                    `Delete this briefing from ${entry.date}? This cannot be undone.`
                  );
                  if (confirmed) {
                    onDeleteBriefing(entry.id);
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = 1;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = 0.5;
                }}
              >
                {'\u{1F5D1}'}
              </button>
            )}
          </span>
        </div>
      ))}

      {/* Empty state when filters produce no results */}
      {hasHistory && entries.length === 0 && (
        <div
          style={{
            padding: '8px 10px',
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            fontStyle: 'italic',
          }}
        >
          No matching briefings
        </div>
      )}

      {/* Welcome entry at the bottom */}
      <div
        style={{
          ...entryStyle(activeView === 'welcome'),
          marginTop: entries.length > 0 || hasHistory ? 'var(--aparture-space-2)' : 0,
        }}
        onClick={() => onSelectView('welcome')}
        onMouseEnter={(e) => {
          if (activeView !== 'welcome') {
            e.currentTarget.style.background = 'var(--aparture-hover)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background =
            activeView === 'welcome' ? 'var(--aparture-sidebar-active)' : 'transparent';
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectView('welcome');
          }
        }}
      >
        <span>Welcome</span>
      </div>
    </div>
  );
}
