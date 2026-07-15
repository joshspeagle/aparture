import Button from '../ui/Button.jsx';

/**
 * Shared header banner for the three pipeline review gates (filter, score,
 * pre-briefing). Rendered at the head of each gate's associated content
 * section so all gates are placed and themed consistently. Consumers:
 * FilterResultsList, ScoreReviewSurface, PreBriefingGate.
 */
export default function ReviewGateBanner({
  title,
  description,
  continueLabel,
  onContinue,
  onSkipRemaining,
  children,
}) {
  return (
    <div
      style={{
        background: 'var(--aparture-surface-2)',
        color: 'var(--aparture-ink)',
        border: '1px solid var(--aparture-border)',
        borderRadius: '8px',
        padding: 'var(--aparture-space-4)',
      }}
    >
      {description && (
        <div
          style={{
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            marginBottom: '4px',
          }}
        >
          {description}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--aparture-space-3)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--aparture-text-base)', fontWeight: 600 }}>
          {title}
        </h2>
        <div style={{ flex: 1 }} />
        <a
          href="https://joshspeagle.github.io/aparture/using/review-gates"
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--aparture-mute)',
            fontSize: 'var(--aparture-text-xs)',
            textDecoration: 'none',
          }}
        >
          docs ↗
        </a>
        {onSkipRemaining && (
          <button
            type="button"
            onClick={onSkipRemaining}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--aparture-mute)',
              fontSize: 'var(--aparture-text-xs)',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Skip remaining gates this run
          </button>
        )}
        <Button variant="primary" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
      {children && <div style={{ marginTop: 'var(--aparture-space-3)' }}>{children}</div>}
    </div>
  );
}
