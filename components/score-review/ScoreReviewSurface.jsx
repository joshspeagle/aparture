import { useState } from 'react';
import TextArea from '../ui/TextArea.jsx';
import ActionPill, { ROW_TINT, SEMANTIC_COLORS } from '../ui/ActionPill.jsx';
import ReviewGateBanner from '../run/ReviewGateBanner.jsx';

function RowComment({ arxivId, onAddPaperComment }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--aparture-mute)',
          fontSize: 'var(--aparture-text-xs, 12px)',
          cursor: 'pointer',
          padding: '2px 0',
        }}
      >
        💬 add comment
      </button>
    );
  }

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setExpanded(false);
      return;
    }
    onAddPaperComment({ arxivId, text: trimmed });
    setExpanded(false);
    setText('');
  };

  return (
    <div style={{ marginTop: '6px' }}>
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Comment on this paper (optional)"
        style={{ minHeight: 'unset' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
        <button
          onClick={() => setExpanded(false)}
          style={{ fontSize: 'var(--aparture-text-xs, 12px)' }}
        >
          cancel
        </button>
        <button onClick={save} style={{ fontSize: 'var(--aparture-text-xs, 12px)' }}>
          save
        </button>
      </div>
    </div>
  );
}

// ScoreRow uses (paper.id ?? paper.arxivId) for the data-testid key, but
// downstream feedback events use arxivId as canonical. Both paths resolve
// to the same string for arXiv papers (which always carry arxivId); the
// id-fallback exists only for legacy paper shapes that predate the arxivId
// field. Consistent with the pattern in handleMSStar/Dismiss in App.jsx.
function ScoreRow({
  paper,
  isStarred,
  isDismissed,
  isInTopN,
  onStar,
  onDismiss,
  onAddPaperComment,
}) {
  const id = paper.id ?? paper.arxivId;
  const rowBg = isDismissed ? ROW_TINT.mute : isStarred ? ROW_TINT.green : 'transparent';
  return (
    <div
      data-testid={`ms-row-${id}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--aparture-space-3, 12px)',
        padding: 'var(--aparture-space-3, 12px)',
        borderTop: '1px solid var(--aparture-border-light)',
        borderLeft: isInTopN ? '3px solid #22c55e' : '3px solid transparent',
        background: rowBg,
        opacity: isDismissed ? 0.55 : 1,
        transition: 'background 150ms ease, opacity 150ms ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--aparture-text-sm, 14px)' }}>
        <div style={{ fontWeight: 500, marginBottom: '2px' }}>{paper.title}</div>
        <div
          style={{
            fontFamily: 'var(--aparture-font-mono, monospace)',
            fontSize: 'var(--aparture-text-xs, 12px)',
            opacity: 0.65,
          }}
        >
          {paper.arxivId} · score {paper.relevanceScore?.toFixed(1)}
        </div>
        {paper.scoreJustification && (
          <div
            style={{ fontSize: 'var(--aparture-text-xs, 12px)', opacity: 0.75, marginTop: '4px' }}
          >
            <em>Score:</em> {paper.scoreJustification.slice(0, 300)}
            {paper.scoreJustification.length > 300 ? '…' : ''}
          </div>
        )}
        {onAddPaperComment && (
          <div style={{ marginTop: '6px' }}>
            <RowComment arxivId={paper.arxivId ?? paper.id} onAddPaperComment={onAddPaperComment} />
          </div>
        )}
      </div>
      <div
        style={{ display: 'flex', flexShrink: 0, gap: '4px', alignItems: 'center' }}
        data-testid={`ms-actions-${id}`}
      >
        <ActionPill
          active={isStarred}
          activeColors={SEMANTIC_COLORS.green}
          glyph={isStarred ? '★' : '☆'}
          label={isStarred ? 'STARRED' : 'STAR'}
          onClick={() => onStar(id)}
          title="Star to guarantee PDF analysis"
          dataTestId={`ms-star-${id}`}
        />
        <ActionPill
          active={isDismissed}
          activeColors={SEMANTIC_COLORS.mute}
          glyph={'✕'}
          label={isDismissed ? 'DISMISSED' : 'DISMISS'}
          onClick={() => onDismiss(id)}
          title="Dismiss to skip PDF analysis"
          dataTestId={`ms-dismiss-${id}`}
        />
      </div>
    </div>
  );
}

function ScoreGroup({
  label,
  papers,
  defaultExpanded,
  isInTopN,
  starredIds,
  dismissedIds,
  onStar,
  onDismiss,
  onAddPaperComment,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (papers.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          padding: 'var(--aparture-space-2, 8px) var(--aparture-space-3, 12px)',
          background: 'var(--aparture-surface-2)',
          color: 'var(--aparture-ink)',
          border: 'none',
          borderTop: '1px solid var(--aparture-border-light)',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'var(--aparture-font-mono, monospace)',
          fontSize: 'var(--aparture-text-xs, 12px)',
          fontWeight: 600,
        }}
      >
        {expanded ? '▼' : '▶'} {label} · {papers.length}
      </button>
      {expanded &&
        papers.map((p) => (
          <ScoreRow
            key={p.id ?? p.arxivId}
            paper={p}
            isStarred={starredIds.has(p.id ?? p.arxivId)}
            isDismissed={dismissedIds.has(p.id ?? p.arxivId)}
            isInTopN={isInTopN}
            onStar={onStar}
            onDismiss={onDismiss}
            onAddPaperComment={onAddPaperComment}
          />
        ))}
    </div>
  );
}

export default function ScoreReviewSurface({
  availablePapers,
  maxDeepAnalysis,
  starredIds,
  dismissedIds,
  onStar,
  onDismiss,
  onContinue,
  onSkipRemaining,
  onAddPaperComment, // optional: fires {arxivId, text} for a per-row paper comment
  scopedCommentInput, // optional: a pre-mounted ScopedCommentInput element for score-review scope
}) {
  const borderlineSize = Math.min(maxDeepAnalysis, 50);
  const topN = availablePapers.slice(0, maxDeepAnalysis);
  const borderline = availablePapers.slice(maxDeepAnalysis, maxDeepAnalysis + borderlineSize);
  const lowScore = availablePapers.slice(maxDeepAnalysis + borderlineSize);

  const groupProps = { starredIds, dismissedIds, onStar, onDismiss, onAddPaperComment };

  return (
    <section
      style={{
        color: 'var(--aparture-ink)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--aparture-space-2, 8px)',
      }}
    >
      <ReviewGateBanner
        title={`Score review — ${availablePapers.length} papers`}
        description="Review your scored papers before PDF analysis. Star to guarantee inclusion; dismiss to skip."
        continueLabel="Continue to PDF analysis →"
        onContinue={onContinue}
        onSkipRemaining={onSkipRemaining}
      >
        {scopedCommentInput}
      </ReviewGateBanner>
      <div
        style={{
          border: '1px solid var(--aparture-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <ScoreGroup
          label="Will PDF (top-N)"
          papers={topN}
          defaultExpanded={true}
          isInTopN={true}
          {...groupProps}
        />
        <ScoreGroup
          label="Borderline"
          papers={borderline}
          defaultExpanded={false}
          isInTopN={false}
          {...groupProps}
        />
        <ScoreGroup
          label="Low score"
          papers={lowScore}
          defaultExpanded={false}
          isInTopN={false}
          {...groupProps}
        />
      </div>
    </section>
  );
}
