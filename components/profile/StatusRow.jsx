export default function StatusRow({ newInteractionCount, lastUpdated, onScrollToFeedback }) {
  const dateStr = lastUpdated ? new Date(lastUpdated).toLocaleDateString() : 'never';
  const hasCount = newInteractionCount > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--aparture-space-2)',
        fontSize: 'var(--aparture-text-xs)',
        color: 'var(--aparture-mute)',
      }}
    >
      {hasCount ? (
        <button
          type="button"
          onClick={onScrollToFeedback}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--aparture-accent)',
            fontWeight: 500,
            fontSize: 'inherit',
            fontFamily: 'var(--aparture-font-sans)',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          {newInteractionCount} new interactions
        </button>
      ) : (
        <span>No new feedback</span>
      )}
      <span>·</span>
      <span>Updated {dateStr}</span>
    </div>
  );
}
