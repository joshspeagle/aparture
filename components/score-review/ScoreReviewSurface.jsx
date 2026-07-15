import { memo, useState } from 'react';
import TextArea from '../ui/TextArea.jsx';
import ActionPill, { ROW_TINT, SEMANTIC_COLORS } from '../ui/ActionPill.jsx';
import ReviewGateBanner from '../run/ReviewGateBanner.jsx';
import { resolveAdditiveSet } from '../../lib/analyzer/resolveAdditiveSet.js';
import { estimateStageCost, formatUsd } from '../../lib/analyzer/costEstimate.js';
import { getModel } from '../../utils/models.js';
import {
  COMMENT_CANCEL_BUTTON_STYLE,
  COMMENT_SAVE_BUTTON_STYLE,
} from '../filter/FilterResultsList.jsx';

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
          type="button"
          onClick={() => setExpanded(false)}
          style={COMMENT_CANCEL_BUTTON_STYLE}
        >
          Cancel
        </button>
        <button type="button" onClick={save} style={COMMENT_SAVE_BUTTON_STYLE}>
          Save
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
//
// Memoized: rows re-render only when their own props change, not on every
// progress tick that re-renders the surrounding gate surface.
const ScoreRow = memo(function ScoreRow({
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
});

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
  pdfModel, // optional: config.pdfModel, enables the projected-spend line
}) {
  const borderlineSize = Math.min(maxDeepAnalysis, 50);
  const topN = availablePapers.slice(0, maxDeepAnalysis);
  const borderline = availablePapers.slice(maxDeepAnalysis, maxDeepAnalysis + borderlineSize);
  const lowScore = availablePapers.slice(maxDeepAnalysis + borderlineSize);

  const groupProps = { starredIds, dismissedIds, onStar, onDismiss, onAddPaperComment };

  // Projected Stage 4 spend for the LIVE selection — recomputed on every
  // star/dismiss because the selection is (top-N ∪ starred) − dismissed,
  // the same resolution startProcessing applies after the gate. Hidden when
  // the PDF model has no registry pricing (never show "$null").
  const pdfSet = resolveAdditiveSet({ availablePapers, maxDeepAnalysis, starredIds, dismissedIds });
  const pdfEstimate = estimateStageCost({
    stage: 'pdf',
    paperCount: pdfSet.length,
    modelId: pdfModel,
  });
  const costLine =
    pdfEstimate.cost != null
      ? `${pdfSet.length} paper${pdfSet.length === 1 ? '' : 's'} will be deep-read — est. ` +
        `${formatUsd(pdfEstimate.cost)} (${getModel(pdfModel)?.name ?? pdfModel})`
      : null;

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
        {/* Conditional so the banner's children wrapper (and its margin)
            doesn't render when there's nothing to put in it. */}
        {costLine || scopedCommentInput ? (
          <>
            {costLine && (
              <div
                style={{
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                  marginBottom: scopedCommentInput ? 'var(--aparture-space-2, 8px)' : 0,
                }}
              >
                {costLine}
              </div>
            )}
            {scopedCommentInput}
          </>
        ) : null}
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
