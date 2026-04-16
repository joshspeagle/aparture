// components/shell/SidebarBriefingList.jsx
// Scrollable list of briefing entries for the sidebar.

import { useMemo, useState } from 'react';
import { filterBriefings } from '../../lib/briefing/filterBriefings.js';
import Input from '../ui/Input.jsx';

function formatBriefingDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayISO = today.toISOString().slice(0, 10);

  if (dateStr === todayISO) {
    return `Today \u00b7 ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  return `${date.toLocaleDateString('en-US', { weekday: 'short' })} \u00b7 ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
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
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);

  const filtered = useMemo(() => {
    if (!briefingHistory?.length) return [];
    return filterBriefings(briefingHistory, feedbackEvents, {
      query: searchQuery || undefined,
      starredOnly: starredOnly || undefined,
    });
  }, [briefingHistory, feedbackEvents, searchQuery, starredOnly]);

  const entries = useMemo(() => {
    return filtered.map((entry) => ({
      date: entry.date,
      label: formatBriefingDate(entry.date),
      starCount: countStars(entry.briefing, feedbackEvents),
      viewId: `briefing:${entry.date}`,
    }));
  }, [filtered, feedbackEvents]);

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
              placeholder="Search\u2026"
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
          <span>{entry.label}</span>
          {entry.starCount > 0 && (
            <span
              style={{
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '11px' }}>{'\u2605'}</span>
              {entry.starCount}
            </span>
          )}
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
