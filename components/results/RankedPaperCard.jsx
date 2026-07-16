// components/results/RankedPaperCard.jsx
// Ranked-results paper card (results list under the pipeline view). Moved out
// of components/shell/App.jsx — where it lived as a module-scope `PaperCard` —
// and renamed to avoid the name collision with components/briefing/PaperCard.jsx.

import PropTypes from 'prop-types';
import { memo, useState } from 'react';
import DuplicateBadge from '../ui/DuplicateBadge.jsx';
import ActionPill, { ROW_TINT, SEMANTIC_COLORS } from '../ui/ActionPill.jsx';
import {
  COMMENT_CANCEL_BUTTON_STYLE,
  COMMENT_SAVE_BUTTON_STYLE,
} from '../ui/commentButtonStyles.js';

// Phase 1.5.1 D5 fix: RankedPaperCard hoisted to module scope so React can reconcile
// cards across re-renders rather than unmount/remount them (which would destroy
// the inline comment textarea state during active scoring / progress ticks).
// All closure-captured data (feedback state, callbacks, briefing date) is now
// passed explicitly as props.
//
// Memoized: with stable handler props from App, a card re-renders only when
// its own paper/feedback props change — not on every progress tick that
// re-renders the results list.
const RankedPaperCard = memo(function RankedPaperCard({
  paper,
  idx,
  showDeepAnalysis,
  starred,
  dismissed,
  briefingDate,
  feedbackEvents = [],
  onStar,
  onDismiss,
  onComment,
}) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');

  const hasFeedbackAffordance = showDeepAnalysis && paper.deepAnalysis;
  const arxivId = paper.id;

  const buildPaperMeta = () => ({
    arxivId,
    paperTitle: paper.title,
    quickSummary: paper.deepAnalysis?.summary ?? paper.scoreJustification ?? '',
    score: paper.finalScore ?? paper.relevanceScore ?? 0,
    briefingDate,
  });

  const handleStar = () => onStar?.(buildPaperMeta());
  const handleDismiss = () => onDismiss?.(buildPaperMeta());
  const handleSaveComment = () => {
    const text = commentText.trim();
    if (text) onComment?.(buildPaperMeta(), text);
    setCommentText('');
    setShowCommentInput(false);
  };
  const handleCancelComment = () => {
    setCommentText('');
    setShowCommentInput(false);
  };

  const badgeBase = {
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-xs)',
    padding: '2px 8px',
    borderRadius: '4px',
    display: 'inline-block',
  };

  const inFinalRanking = showDeepAnalysis && paper.deepAnalysis;
  const rowTint = starred ? ROW_TINT.green : dismissed ? ROW_TINT.mute : 'var(--aparture-surface)';
  return (
    <div
      style={{
        background: rowTint,
        borderRadius: '4px',
        padding: 'var(--aparture-space-4)',
        border: '1px solid var(--aparture-hairline)',
        borderLeft: inFinalRanking ? '3px solid #22c55e' : '1px solid var(--aparture-hairline)',
        opacity: dismissed ? 0.55 : 1,
        transition: 'border-color 150ms ease, background 150ms ease, opacity 150ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--aparture-space-3)',
          marginBottom: '8px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: rank + final score + arXiv link */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ ...badgeBase, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
              #{idx + 1}
            </span>
            <span style={{ ...badgeBase, background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
              {(paper.finalScore ?? paper.relevanceScore ?? 0).toFixed(1)}/10
            </span>
            <a
              href={`https://arxiv.org/abs/${paper.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...badgeBase,
                background: 'var(--aparture-bg)',
                color: 'var(--aparture-mute)',
                textDecoration: 'none',
                marginLeft: 'auto',
              }}
            >
              arXiv:{paper.id}
            </a>
          </div>
          {/* Score trail: abstract → rescore → PDF */}
          {(paper.scoreAdjustment || paper.deepAnalysis) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
                flexWrap: 'wrap',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: '11px',
                color: 'var(--aparture-mute)',
              }}
            >
              {/* Abstract score */}
              <span
                style={{
                  ...badgeBase,
                  background: 'var(--aparture-bg)',
                  color: 'var(--aparture-mute)',
                  fontSize: '11px',
                }}
              >
                Abstract: {(paper.initialScore ?? paper.relevanceScore ?? 0).toFixed(1)}
              </span>
              {/* Rescore */}
              {paper.scoreAdjustment != null && Math.abs(paper.scoreAdjustment) > 0.01 && (
                <>
                  <span style={{ color: 'var(--aparture-mute)' }}>{'\u2192'}</span>
                  <span
                    style={{
                      ...badgeBase,
                      fontSize: '11px',
                      background:
                        paper.scoreAdjustment > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
                      color: paper.scoreAdjustment > 0 ? '#22c55e' : '#f97316',
                    }}
                  >
                    Rescore: {(paper.adjustedScore ?? paper.relevanceScore ?? 0).toFixed(1)}
                    {' ('}
                    {paper.scoreAdjustment > 0 ? '\u2191' : '\u2193'}
                    {Math.abs(paper.scoreAdjustment).toFixed(1)}
                    {')'}
                  </span>
                </>
              )}
              {/* PDF score */}
              {paper.finalScore != null && paper.deepAnalysis && (
                <>
                  <span style={{ color: 'var(--aparture-mute)' }}>{'\u2192'}</span>
                  <span
                    style={{
                      ...badgeBase,
                      fontSize: '11px',
                      background:
                        paper.pdfScoreAdjustment > 0
                          ? 'rgba(34,197,94,0.1)'
                          : paper.pdfScoreAdjustment < 0
                            ? 'rgba(249,115,22,0.1)'
                            : 'var(--aparture-bg)',
                      color:
                        paper.pdfScoreAdjustment > 0
                          ? '#22c55e'
                          : paper.pdfScoreAdjustment < 0
                            ? '#f97316'
                            : 'var(--aparture-mute)',
                    }}
                  >
                    PDF: {paper.finalScore.toFixed(1)}
                    {paper.pdfScoreAdjustment != null &&
                      Math.abs(paper.pdfScoreAdjustment) > 0.01 && (
                        <>
                          {' ('}
                          {paper.pdfScoreAdjustment > 0 ? '\u2191' : '\u2193'}
                          {Math.abs(paper.pdfScoreAdjustment).toFixed(1)}
                          {')'}
                        </>
                      )}
                  </span>
                </>
              )}
            </div>
          )}
          {/* Adjustment reasons (visible, not hidden in tooltips) */}
          {paper.adjustmentReason && (
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: '11px',
                color: 'var(--aparture-mute)',
                marginBottom: '4px',
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontWeight: 500 }}>Rescore:</span> {paper.adjustmentReason}
            </p>
          )}
          <h3
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-lg)',
              fontWeight: 600,
              color: 'var(--aparture-ink)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span>{paper.title}</span>
            <DuplicateBadge isDuplicate={paper.isDuplicate} firstSeenDate={paper.firstSeenDate} />
          </h3>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-mute)',
              marginBottom: '8px',
            }}
          >
            {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
          </p>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-ink)',
              fontStyle: 'italic',
              marginBottom: '8px',
            }}
          >
            {paper.deepAnalysis?.relevanceAssessment || paper.scoreJustification}
          </p>
          {showDeepAnalysis && paper.deepAnalysis && (
            <div
              style={{
                marginTop: 'var(--aparture-space-3)',
                paddingTop: 'var(--aparture-space-3)',
                borderTop: '1px solid var(--aparture-hairline)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-sm)',
                  color: 'var(--aparture-ink)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}
              >
                {paper.deepAnalysis.summary}
              </div>
            </div>
          )}

          {hasFeedbackAffordance && showCommentInput && (
            <div
              style={{
                marginTop: 'var(--aparture-space-3)',
                paddingTop: 'var(--aparture-space-3)',
                borderTop: '1px solid var(--aparture-hairline)',
              }}
            >
              <div>
                {(() => {
                  const pastComments = feedbackEvents.filter(
                    (e) => e.type === 'paper-comment' && e.arxivId === paper.id
                  );
                  if (pastComments.length === 0) return null;
                  return (
                    <div
                      style={{
                        marginBottom: '8px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: 'var(--aparture-bg)',
                        border: '1px solid var(--aparture-hairline)',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--aparture-font-sans)',
                          fontSize: '10px',
                          color: 'var(--aparture-mute)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '4px',
                        }}
                      >
                        Past comments ({pastComments.length})
                      </div>
                      {pastComments.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            display: 'flex',
                            gap: '6px',
                            fontFamily: 'var(--aparture-font-sans)',
                            fontSize: 'var(--aparture-text-xs)',
                            lineHeight: 1.4,
                            marginBottom: '2px',
                          }}
                        >
                          <span style={{ color: 'var(--aparture-mute)', flexShrink: 0 }}>
                            {new Date(c.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span style={{ color: 'var(--aparture-ink)' }}>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  placeholder="Your thoughts on this paper…"
                  style={{
                    width: '100%',
                    minHeight: '4rem',
                    resize: 'vertical',
                    borderRadius: '4px',
                    border: '1px solid var(--aparture-hairline)',
                    background: 'var(--aparture-bg)',
                    padding: '4px 8px',
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-ink)',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                <div
                  style={{
                    marginTop: '4px',
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCancelComment}
                    style={COMMENT_CANCEL_BUTTON_STYLE}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    disabled={commentText.trim().length === 0}
                    style={{
                      ...COMMENT_SAVE_BUTTON_STYLE,
                      cursor: commentText.trim().length === 0 ? 'not-allowed' : 'pointer',
                      opacity: commentText.trim().length === 0 ? 0.5 : 1,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {hasFeedbackAffordance && (
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              gap: '4px',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginLeft: 'var(--aparture-space-3)',
            }}
          >
            <ActionPill
              active={starred}
              activeColors={SEMANTIC_COLORS.green}
              glyph={starred ? '\u2605' : '\u2606'}
              label={starred ? 'STARRED' : 'STAR'}
              onClick={handleStar}
              title={starred ? 'Remove star' : 'Star this paper'}
            />
            <ActionPill
              active={dismissed}
              activeColors={SEMANTIC_COLORS.mute}
              glyph={'\u2298'}
              label={dismissed ? 'DISMISSED' : 'DISMISS'}
              onClick={handleDismiss}
              title={dismissed ? 'Remove dismiss' : 'Dismiss this paper'}
            />
            <ActionPill
              active={showCommentInput}
              activeColors={SEMANTIC_COLORS.amber}
              label="COMMENT"
              glyph={'+'}
              onClick={() => setShowCommentInput((v) => !v)}
              title="Leave a comment on this paper"
            />
          </div>
        )}
      </div>
    </div>
  );
});

RankedPaperCard.propTypes = {
  paper: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    authors: PropTypes.arrayOf(PropTypes.string).isRequired,
    finalScore: PropTypes.number,
    relevanceScore: PropTypes.number,
    scoreAdjustment: PropTypes.number,
    adjustmentReason: PropTypes.string,
    scoreJustification: PropTypes.string,
    deepAnalysis: PropTypes.shape({
      relevanceAssessment: PropTypes.string,
      summary: PropTypes.string,
    }),
  }).isRequired,
  idx: PropTypes.number.isRequired,
  showDeepAnalysis: PropTypes.bool.isRequired,
  starred: PropTypes.bool,
  dismissed: PropTypes.bool,
  briefingDate: PropTypes.string,
  feedbackEvents: PropTypes.array,
  onStar: PropTypes.func,
  onDismiss: PropTypes.func,
  onComment: PropTypes.func,
};

export default RankedPaperCard;
