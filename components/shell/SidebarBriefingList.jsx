// components/shell/SidebarBriefingList.jsx
// Scrollable list of briefing entries for the sidebar.

import { useMemo } from 'react';

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
  const entries = useMemo(() => {
    if (!briefingHistory?.length) return [];
    return briefingHistory.map((entry) => ({
      date: entry.date,
      label: formatBriefingDate(entry.date),
      starCount: countStars(entry.briefing, feedbackEvents),
      viewId: `briefing:${entry.date}`,
    }));
  }, [briefingHistory, feedbackEvents]);

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

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 var(--aparture-space-2)',
      }}
    >
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

      {/* Welcome entry at the bottom */}
      <div
        style={{
          ...entryStyle(activeView === 'welcome'),
          marginTop: entries.length > 0 ? 'var(--aparture-space-2)' : 0,
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
