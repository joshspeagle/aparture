// components/shell/Sidebar.jsx
// Full left sidebar: logo, + New Briefing, briefing list, config entries, theme toggle.

import { useTheme } from '../../hooks/useTheme.js';
import Button from '../ui/Button.jsx';
import SidebarBriefingList from './SidebarBriefingList.jsx';

const sectionLabel = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--aparture-mute)',
  padding: '0 var(--aparture-space-3)',
  marginBottom: 'var(--aparture-space-1)',
};

function NavEntry({ label, isActive, onClick }) {
  return (
    <div
      style={{
        padding: '6px 10px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'var(--aparture-font-sans)',
        fontSize: 'var(--aparture-text-sm)',
        color: 'var(--aparture-ink)',
        background: isActive ? 'var(--aparture-sidebar-active)' : 'transparent',
        transition: 'background 100ms ease',
        margin: '0 var(--aparture-space-2)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--aparture-hover)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive
          ? 'var(--aparture-sidebar-active)'
          : 'transparent';
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {label}
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid var(--aparture-hairline)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-label="Light mode"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '3px 8px',
          fontSize: '14px',
          opacity: isLight ? 1 : 0.35,
          transition: 'opacity 150ms ease',
          lineHeight: 1,
        }}
      >
        {'\u2600'}
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-label="Dark mode"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '3px 8px',
          fontSize: '14px',
          opacity: isLight ? 0.35 : 1,
          transition: 'opacity 150ms ease',
          lineHeight: 1,
        }}
      >
        {'\u263e'}
      </button>
    </div>
  );
}

export default function Sidebar({
  briefingHistory,
  feedbackEvents,
  activeView,
  onSelectView,
  onNewBriefing,
  feedbackCount,
  onDeleteBriefing,
  onToggleArchive,
}) {
  return (
    <div className="shell-sidebar">
      {/* Logo */}
      <div
        style={{
          padding: 'var(--aparture-space-4) var(--aparture-space-3)',
          paddingBottom: 'var(--aparture-space-3)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--aparture-font-serif)',
            fontSize: 'var(--aparture-text-lg)',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--aparture-ink)',
          }}
        >
          <span>ap</span>
          <span style={{ color: 'var(--aparture-accent)' }}>ar</span>
          <span>ture</span>
        </div>
      </div>

      {/* + New Briefing button */}
      <div
        style={{
          padding: '0 var(--aparture-space-3)',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        <Button variant="primary" onClick={onNewBriefing} style={{ width: '100%' }}>
          + New Briefing
        </Button>
      </div>

      {/* BRIEFINGS section */}
      <div style={{ ...sectionLabel, marginBottom: 'var(--aparture-space-2)' }}>Briefings</div>

      <SidebarBriefingList
        briefingHistory={briefingHistory}
        feedbackEvents={feedbackEvents}
        activeView={activeView}
        onSelectView={onSelectView}
        onDeleteBriefing={onDeleteBriefing}
        onToggleArchive={onToggleArchive}
      />

      {/* Separator */}
      <div
        style={{
          borderTop: '1px solid var(--aparture-hairline)',
          margin: 'var(--aparture-space-3) var(--aparture-space-3)',
        }}
      />

      {/* CONFIGURATION section */}
      <div style={{ ...sectionLabel, marginBottom: 'var(--aparture-space-1)' }}>Configuration</div>

      <NavEntry
        label="Profile"
        isActive={activeView === 'profile'}
        onClick={() => onSelectView('profile')}
      />
      <NavEntry
        label="Settings"
        isActive={activeView === 'settings'}
        onClick={() => onSelectView('settings')}
      />
      <NavEntry
        label="Pipeline"
        isActive={activeView === 'pipeline'}
        onClick={() => onSelectView('pipeline')}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div
        style={{
          padding: 'var(--aparture-space-3)',
          borderTop: '1px solid var(--aparture-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
          }}
        >
          {feedbackCount != null && feedbackCount > 0 ? `${feedbackCount} feedback` : ''}
        </span>
        <ThemeToggle />
      </div>
    </div>
  );
}
