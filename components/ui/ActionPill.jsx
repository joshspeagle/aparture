// Pill-style action button used across the three review surfaces
// (FilterResultsList verdict buttons, ScoreReviewSurface star/dismiss,
// PaperCard star/dismiss/comment). Rounded-full, uppercase, semantic-
// colored when active. activeColors expects { bg, color, border } —
// see SEMANTIC_COLORS below for the shared palette.

// The mute variant uses token-based tints (not black-based rgba): a black
// tint over the dark theme's near-black surfaces is invisible, whereas
// --aparture-surface-2 / --aparture-hover shift correctly in both themes.
export const SEMANTIC_COLORS = {
  green: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '#22c55e' },
  amber: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '#f59e0b' },
  red: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '#ef4444' },
  mute: {
    bg: 'var(--aparture-surface-2)',
    color: 'var(--aparture-ink)',
    border: 'var(--aparture-mute)',
  },
};

// Lighter tints for whole-row backgrounds — same palette, desaturated so
// the row reads as state-decorated rather than as a callout.
export const ROW_TINT = {
  green: 'rgba(34,197,94,0.06)',
  amber: 'rgba(245,158,11,0.06)',
  red: 'rgba(239,68,68,0.06)',
  mute: 'var(--aparture-surface-2)',
};

export default function ActionPill({
  active,
  activeColors,
  label,
  glyph,
  onClick,
  title,
  dataTestId,
  disabled,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-testid={dataTestId}
      disabled={disabled}
      aria-pressed={Boolean(active)}
      style={{
        padding: '2px 8px',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: '9999px',
        border: `1px solid ${active ? activeColors.border : 'var(--aparture-hairline)'}`,
        background: active ? activeColors.bg : 'transparent',
        color: active ? activeColors.color : 'var(--aparture-mute)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'var(--aparture-font-sans)',
        fontWeight: active ? 600 : 400,
        transition: 'all 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {glyph ? `${glyph} ${label}` : label}
    </button>
  );
}
