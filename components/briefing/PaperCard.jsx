import { useState } from 'react';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import DuplicateBadge from '../ui/DuplicateBadge.jsx';

// Stable empty fallback so the Zustand selector returns the same reference
// when reactContext.seenPapersIndex is undefined (pre-migration). Otherwise
// the inline `?? {}` would create a new object literal on every selector
// call and trigger spurious re-renders.
const EMPTY_SEEN_INDEX = Object.freeze({});

const MAX_EVENT_SUMMARY_CHARS = 800;

// Anchors inherit colour with no underline app-wide (styles/globals.css), so
// these need an underline to read as links inside the muted meta line.
const PAPER_LINK_STYLE = {
  color: 'var(--aparture-mute)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
};

// Where to read the paper: the arXiv abstract page, the PDF, arXiv's HTML
// rendering (easier to read on screen, when the paper has one), and
// alphaXiv's discussion overlay. Exported for tests.
export function paperLinks(arxivId) {
  if (!arxivId) return [];
  const id = encodeURI(String(arxivId));
  return [
    { label: 'abstract', href: `https://arxiv.org/abs/${id}` },
    { label: 'PDF', href: `https://arxiv.org/pdf/${id}` },
    { label: 'HTML', href: `https://arxiv.org/html/${id}` },
    { label: 'alphaXiv', href: `https://www.alphaxiv.org/abs/${id}` },
  ];
}

// What a star / dismiss / comment made on a briefing card tells the Suggest
// prompt about the paper (it renders this as "Summary: …"). Synthesized
// briefing papers carry no quickSummary — that lives in quickSummariesById —
// so these events used to reach suggest-profile as a bare title. Use the
// card's own pitch and why-it-matters instead, unless the paper object does
// carry a quick summary (older shapes). Shared with App's card-comment
// handler.
export function briefingPaperSummary(paper) {
  const quick = typeof paper?.quickSummary === 'string' ? paper.quickSummary.trim() : '';
  const text =
    quick ||
    [paper?.onelinePitch, paper?.whyMatters]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .join(' ');
  return text.length > MAX_EVENT_SUMMARY_CHARS
    ? `${text.slice(0, MAX_EVENT_SUMMARY_CHARS)}…`
    : text;
}

export default function PaperCard({
  paper,
  starred = false,
  dismissed = false,
  briefingDate,
  feedbackEvents = [],
  onStar,
  onDismiss,
  onAddComment,
  onOpenQuickSummary,
  onOpenFullReport,
  // True when the card belongs to a TEST MODE (dry-run) briefing: reactions
  // are then tagged as test feedback and kept out of suggestions. Forwarded
  // from BriefingView's own testMode prop.
  testMode = false,
}) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const scoreHigh = paper.score >= 9;

  // Briefing papers come from LLM synthesis output, not from the
  // analyzer-side decorated paper objects, so paper.isDuplicate is never
  // set here. Read the live seen-papers index from the store instead and
  // derive the flag from arxivId presence. The lookup is per-render but
  // O(1) and the index is a stable reference between writes.
  const seenPapersIndex = useAnalyzerStore(
    (s) => s.reactContext?.seenPapersIndex ?? EMPTY_SEEN_INDEX
  );
  const firstSeenDate = seenPapersIndex[paper.arxivId];
  const isDuplicate = Boolean(firstSeenDate);

  const buildMeta = () => ({
    arxivId: paper.arxivId,
    paperTitle: paper.title,
    quickSummary: briefingPaperSummary(paper),
    score: paper.score,
    briefingDate,
    ...(testMode ? { testMode: true } : {}),
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
        {(paper.score ?? 0).toFixed(1)}
      </span>
      <h3 className="paper-title">
        {paper.title}
        {isDuplicate && (
          <span style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
            <DuplicateBadge isDuplicate={isDuplicate} firstSeenDate={firstSeenDate} />
          </span>
        )}
      </h3>
      <div className="paper-meta">
        <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noreferrer">
          {paper.arxivId}
        </a>
        <span data-testid="paper-links">
          {paperLinks(paper.arxivId).map((link) => (
            <span key={link.label}>
              {' · '}
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} for ${paper.title ?? paper.arxivId} (opens in a new tab)`}
                style={PAPER_LINK_STYLE}
              >
                {link.label}
              </a>
            </span>
          ))}
        </span>
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
      {(() => {
        const comments = feedbackEvents.filter(
          (e) => e.type === 'paper-comment' && e.arxivId === paper.arxivId
        );
        if (comments.length === 0) return null;
        return (
          <div className="paper-comments">
            {comments.map((c) => (
              <div key={c.id} className="paper-comment-entry">
                <span className="paper-comment-date">
                  {new Date(c.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="paper-comment-text">{c.text}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </section>
  );
}
