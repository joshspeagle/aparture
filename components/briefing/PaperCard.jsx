export default function PaperCard({
  paper,
  onStar,
  onDismiss,
  onOpenQuickSummary,
  onOpenFullReport,
}) {
  const scoreHigh = paper.score >= 9;
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
        <button type="button" aria-label="star" onClick={() => onStar?.(paper.arxivId)}>
          ☆ star
        </button>
        <button type="button" aria-label="dismiss" onClick={() => onDismiss?.(paper.arxivId)}>
          ⊘ dismiss
        </button>
      </div>
    </section>
  );
}
