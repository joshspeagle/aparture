import { useState } from 'react';
import { Star, X } from 'lucide-react';
import TextArea from '../ui/TextArea.jsx';

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
          color: 'var(--aparture-mute, #6b7280)',
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
  return (
    <div
      data-testid={`ms-row-${id}`}
      style={{
        display: 'flex',
        gap: 'var(--aparture-space-3, 12px)',
        padding: 'var(--aparture-space-3, 12px)',
        borderTop: '1px solid var(--aparture-border-light, #f3f4f6)',
        borderLeft: isInTopN ? '3px solid #22c55e' : '3px solid transparent',
        background: isDismissed
          ? 'var(--aparture-surface-muted, #f9fafb)'
          : isStarred
            ? 'var(--aparture-accent-soft, #fffbeb)'
            : 'transparent',
        opacity: isDismissed ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          data-testid={`ms-star-${id}`}
          onClick={() => onStar(id)}
          aria-label="Star to guarantee PDF analysis"
          style={{
            padding: '4px',
            background: isStarred ? '#f59e0b' : 'transparent',
            color: isStarred ? 'white' : 'var(--aparture-mute, #9ca3af)',
            border: '1px solid var(--aparture-border, #e5e7eb)',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          <Star size={14} />
        </button>
        <button
          data-testid={`ms-dismiss-${id}`}
          onClick={() => onDismiss(id)}
          aria-label="Dismiss to skip PDF analysis"
          style={{
            padding: '4px',
            background: isDismissed ? '#ef4444' : 'transparent',
            color: isDismissed ? 'white' : 'var(--aparture-mute, #9ca3af)',
            border: '1px solid var(--aparture-border, #e5e7eb)',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ flex: 1, fontSize: 'var(--aparture-text-sm, 14px)' }}>
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
          background: 'var(--aparture-surface-2, #f9fafb)',
          border: 'none',
          borderTop: '1px solid var(--aparture-border-light, #f3f4f6)',
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
        border: '1px solid var(--aparture-border, #e5e7eb)',
        borderRadius: 'var(--aparture-radius-md, 8px)',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: 'var(--aparture-space-4, 16px)',
          background: 'var(--aparture-surface-2, #f9fafb)',
          borderBottom: '1px solid var(--aparture-border, #e5e7eb)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--aparture-text-xs, 12px)',
            color: 'var(--aparture-mute, #6b7280)',
            marginBottom: '4px',
          }}
        >
          New: review your scored papers before PDF analysis. Star to guarantee inclusion; dismiss
          to skip.
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--aparture-space-3, 12px)' }}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--aparture-text-base, 16px)', fontWeight: 600 }}>
            Score review — {availablePapers.length} papers
          </h2>
          <div style={{ flex: 1 }} />
          {onSkipRemaining && (
            <button
              onClick={onSkipRemaining}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--aparture-mute, #6b7280)',
                fontSize: 'var(--aparture-text-xs, 12px)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Skip remaining gates this run
            </button>
          )}
          <button
            onClick={onContinue}
            style={{
              padding: '6px 14px',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Continue to PDF analysis →
          </button>
        </div>
        {scopedCommentInput && (
          <div style={{ marginTop: 'var(--aparture-space-3, 12px)' }}>{scopedCommentInput}</div>
        )}
      </header>
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
    </section>
  );
}
