// components/shell/AnalyzedExpander.jsx
// Pre-briefing expander: shows papers that were PDF-analyzed but didn't make
// finalRanking. Rendered by MainArea when stage === 'pre-briefing-review' and
// allAnalyzedPapers.length > finalRanking.length.

/**
 * @param {{
 *   allAnalyzedPapers: Array<object>,
 *   finalRanking: Array<object>,
 *   renderPaperCard: (paper: object, idx: number, showDeepAnalysis: boolean) => React.ReactNode,
 *   onPromotePaper?: (paper: object) => void,
 * }} props
 */
export default function AnalyzedExpander({
  allAnalyzedPapers,
  finalRanking,
  renderPaperCard,
  onPromotePaper,
}) {
  const cutPapers = allAnalyzedPapers.filter(
    (p) => !(finalRanking ?? []).some((top) => (top.id ?? top.arxivId) === (p.id ?? p.arxivId))
  );
  const extraCount = cutPapers.length;
  const topCount = finalRanking?.length ?? 0;

  if (extraCount === 0) return null;

  return (
    <details
      style={{
        marginTop: 'var(--aparture-space-4, 16px)',
        padding: 'var(--aparture-space-3, 12px)',
        background: 'var(--aparture-surface-2, var(--aparture-surface))',
        border: '1px solid var(--aparture-border, var(--aparture-hairline))',
        borderRadius: '6px',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 'var(--aparture-text-sm, 14px)',
          color: 'var(--aparture-mute)',
          fontWeight: 500,
          fontFamily: 'var(--aparture-font-sans)',
        }}
      >
        + Show {extraCount} more PDF-analyzed papers
      </summary>
      {cutPapers.map((paper, idx) => (
        <div
          key={paper.id ?? paper.arxivId}
          style={{ opacity: 0.7, marginTop: 'var(--aparture-space-2, 8px)' }}
        >
          {renderPaperCard(paper, topCount + idx, true)}
          {onPromotePaper && (
            <div style={{ marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => onPromotePaper(paper)}
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--aparture-hairline)',
                  background: 'transparent',
                  color: 'var(--aparture-mute)',
                  cursor: 'pointer',
                }}
              >
                ★ promote to briefing
              </button>
            </div>
          )}
        </div>
      ))}
    </details>
  );
}
