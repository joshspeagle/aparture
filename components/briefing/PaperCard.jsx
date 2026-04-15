import { useState } from 'react';

export default function PaperCard({
  paper,
  starred = false,
  dismissed = false,
  briefingDate,
  onStar,
  onDismiss,
  onAddComment,
  onOpenQuickSummary,
  onOpenFullReport,
}) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const scoreHigh = paper.score >= 9;

  const buildMeta = () => ({
    arxivId: paper.arxivId,
    paperTitle: paper.title,
    quickSummary: paper.quickSummary,
    score: paper.score,
    briefingDate,
  });

  const handleStar = () => onStar?.(buildMeta());
  const handleDismiss = () => onDismiss?.(buildMeta());

  const handleSaveComment = () => {
    const text = commentText.trim();
    if (text) onAddComment?.(paper.arxivId, text);
    setCommentText('');
    setShowCommentInput(false);
  };

  const handleCancelComment = () => {
    setCommentText('');
    setShowCommentInput(false);
  };

  return (
    <section className="paper-card">
      <span className={`score-badge${scoreHigh ? ' score-high' : ''}`}>
        {paper.score.toFixed(1)}
      </span>
      <h3 className="paper-title">{paper.title}</h3>
      <div className="paper-meta">
        <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noreferrer">
          {paper.arxivId}
        </a>
      </div>
      <hr className="hairline" />
      <p className="italic-pitch">{paper.onelinePitch}</p>
      <p>{paper.whyMatters}</p>
      <div className="action-row">
        <button type="button" onClick={() => onOpenQuickSummary?.(paper.arxivId)}>
          → quick summary
        </button>
        <button type="button" onClick={() => onOpenFullReport?.(paper.arxivId)}>
          → full report
        </button>
        <button
          type="button"
          aria-label="star"
          aria-pressed={starred}
          onClick={handleStar}
          className={starred ? 'active-star' : ''}
        >
          {starred ? '★' : '☆'} star
        </button>
        <button
          type="button"
          aria-label="dismiss"
          aria-pressed={dismissed}
          onClick={handleDismiss}
          className={dismissed ? 'active-dismiss' : ''}
        >
          ⊘ dismiss
        </button>
        <button
          type="button"
          aria-label="add comment"
          onClick={() => setShowCommentInput((v) => !v)}
        >
          + comment
        </button>
      </div>
      {showCommentInput && (
        <div className="comment-input">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={6}
            placeholder="Your thoughts on this paper…"
          />
          <div className="comment-actions">
            <button type="button" onClick={handleCancelComment}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveComment}
              disabled={commentText.trim().length === 0}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
