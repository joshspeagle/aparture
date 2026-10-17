import { useEffect, useRef } from 'react';
import Button from '../ui/Button.jsx';

// Visually hidden but read by screen readers.
const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

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
  // A gate appears below everything the run has produced so far, often
  // thousands of pixels down. Bring it into view once, when it appears, and
  // announce it, so the pause is noticed instead of looking like a stall.
  const rootRef = useRef(null);
  // Screen readers announce changes to a live region, not its initial
  // content, so the message is written after the region is in the page.
  const liveRef = useRef(null);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    rootRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (liveRef.current) liveRef.current.textContent = 'The run is paused for your review.';
  }, []);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={typeof title === 'string' ? title : 'Review gate'}
      style={{
        background: 'var(--aparture-surface-2)',
        color: 'var(--aparture-ink)',
        border: '1px solid var(--aparture-border)',
        borderRadius: '8px',
        padding: 'var(--aparture-space-4)',
      }}
    >
      <span ref={liveRef} role="status" style={srOnly} />
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
      {/* flexWrap lets the docs link / skip link / Continue button drop to
          their own line on narrow (mobile) viewports instead of overflowing;
          on desktop everything fits on one line as before. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--aparture-space-2) var(--aparture-space-3)',
        }}
      >
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
            className="touch-target"
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
        <Button variant="primary" className="touch-target" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
      {children && <div style={{ marginTop: 'var(--aparture-space-3)' }}>{children}</div>}
    </div>
  );
}
