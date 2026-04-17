import { FileText, TestTube } from 'lucide-react';
import Card from '../ui/Card.jsx';

export default function AnalysisResultsList({
  results,
  testState,
  processing,
  abstractOnlyPapers,
  renderPaperCard,
}) {
  if (results.scoredPapers.length === 0 && results.finalRanking.length === 0) return null;

  // Show the two-section view (deep-analyzed papers above, abstract-only
  // below) once we've reached PDF analysis and through every stage that
  // follows it (briefing review, synthesizing, etc.) — otherwise the
  // panel collapses back to a flat abstract list once briefing kicks in.
  const POST_PDF_STAGES = new Set([
    'deep-analysis',
    'complete',
    'pre-briefing-review',
    'synthesizing',
  ]);
  const showTwoSections = results.finalRanking.length > 0 && POST_PDF_STAGES.has(processing.stage);

  const testBadgeStyle = {
    marginLeft: '12px',
    padding: '2px 8px',
    background: 'rgba(245,158,11,0.12)',
    color: '#f59e0b',
    fontSize: 'var(--aparture-text-xs)',
    fontFamily: 'var(--aparture-font-sans)',
    borderRadius: '9999px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  };

  return (
    <Card>
      <div
        style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--aparture-space-4)' }}
      >
        <FileText className="w-5 h-5" style={{ marginRight: '8px', color: '#22c55e' }} />
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xl)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
          }}
        >
          {results.finalRanking.length > 0 ? 'Analysis Results' : 'Scored Papers'}
        </h2>
        {testState.dryRunInProgress && (
          <span style={testBadgeStyle}>
            <TestTube className="w-3 h-3" />
            TEST DATA
          </span>
        )}
      </div>

      {showTwoSections ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-6)' }}>
          <div>
            <h3
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-lg)',
                fontWeight: 500,
                marginBottom: 'var(--aparture-space-3)',
                color: '#3b82f6',
              }}
            >
              Papers with Deep PDF Analysis ({results.finalRanking.length})
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '1000px',
                overflowY: 'auto',
                paddingRight: '8px',
              }}
            >
              {results.finalRanking.map((paper, idx) => renderPaperCard(paper, idx, true))}
            </div>
          </div>

          {abstractOnlyPapers.length > 0 && (
            <div>
              <h3
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-lg)',
                  fontWeight: 500,
                  marginBottom: 'var(--aparture-space-3)',
                  color: 'var(--aparture-mute)',
                }}
              >
                Abstract-Only Scores ({abstractOnlyPapers.length})
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '750px',
                  overflowY: 'auto',
                  paddingRight: '8px',
                }}
              >
                {abstractOnlyPapers.map((paper, idx) =>
                  renderPaperCard(paper, results.finalRanking.length + idx, false)
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '500px',
            overflowY: 'auto',
            paddingRight: '8px',
          }}
        >
          {results.scoredPapers.map((paper, idx) => renderPaperCard(paper, idx, false))}
        </div>
      )}
    </Card>
  );
}
