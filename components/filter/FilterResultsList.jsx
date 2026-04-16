import { FileText, TestTube } from 'lucide-react';
import Card from '../ui/Card.jsx';

function FilterResultRow({ paper, verdict, borderColor, processingIsRunning, onCycleVerdict }) {
  const pillColors =
    verdict === 'YES'
      ? { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '#22c55e' }
      : verdict === 'MAYBE'
        ? { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '#f59e0b' }
        : { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '#ef4444' };
  const overridden = paper.originalVerdict && paper.originalVerdict !== verdict;

  return (
    <div
      style={{
        background: 'var(--aparture-bg)',
        borderRadius: '4px',
        padding: 'var(--aparture-space-3)',
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--aparture-space-3)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              color: 'var(--aparture-ink)',
            }}
          >
            {paper.title}
          </h4>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
          </p>
          {paper.filterSummary && (
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-ink)',
                fontStyle: 'italic',
                marginTop: '8px',
              }}
            >
              {paper.filterSummary}
            </p>
          )}
          {paper.filterJustification && (
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                marginTop: '4px',
              }}
            >
              <span style={{ fontWeight: 500 }}>Verdict reasoning:</span>{' '}
              {paper.filterJustification}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCycleVerdict(paper.id, verdict)}
          title={
            overridden
              ? `Filter originally said ${paper.originalVerdict}. Click to cycle.`
              : 'Click to override the filter verdict (cycles YES \u2192 MAYBE \u2192 NO)'
          }
          disabled={processingIsRunning}
          style={{
            flexShrink: 0,
            padding: '2px 8px',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderRadius: '9999px',
            border: `1px solid ${pillColors.border}`,
            background: pillColors.bg,
            color: pillColors.color,
            cursor: processingIsRunning ? 'not-allowed' : 'pointer',
            opacity: processingIsRunning ? 0.5 : 1,
            fontFamily: 'var(--aparture-font-sans)',
            transition: 'all 150ms ease',
          }}
        >
          {verdict}
          {overridden && <span style={{ marginLeft: '4px' }}>{'\u21C4'}</span>}
        </button>
      </div>
    </div>
  );
}

export default function FilterResultsList({
  filterResults,
  filterSortedPapers,
  testState,
  processing,
  onCycleVerdict,
}) {
  const hasAny =
    filterResults.yes.length > 0 || filterResults.maybe.length > 0 || filterResults.no.length > 0;
  if (!hasAny) return null;

  const { unscoredYes, unscoredMaybe, unscoredNo, scoredYesCount, scoredMaybeCount } =
    filterSortedPapers;

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

  const sectionTitleStyle = (color) => ({
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    fontWeight: 500,
    marginBottom: '8px',
    color,
  });

  return (
    <Card>
      <div
        style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--aparture-space-4)' }}
      >
        <FileText className="w-5 h-5" style={{ marginRight: '8px', color: '#f59e0b' }} />
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xl)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
          }}
        >
          Filtered Papers
          {filterResults.inProgress && (
            <span
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                color: 'var(--aparture-mute)',
                marginLeft: '8px',
              }}
            >
              (Processing batch {filterResults.currentBatch || 0} of{' '}
              {filterResults.totalBatches || 0})
            </span>
          )}
        </h2>
        {testState.dryRunInProgress && (
          <span style={testBadgeStyle}>
            <TestTube className="w-3 h-3" />
            TEST DATA
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
        {unscoredYes.length > 0 && (
          <div>
            <h3 style={sectionTitleStyle('#22c55e')}>
              {'\u2713'} YES ({unscoredYes.length})
              {scoredYesCount > 0 && (
                <span
                  style={{
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-mute)',
                    marginLeft: '8px',
                  }}
                >
                  ({scoredYesCount} scored)
                </span>
              )}
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '800px',
                overflowY: 'auto',
                paddingRight: '8px',
              }}
            >
              {unscoredYes.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="YES"
                  borderColor="rgba(34,197,94,0.2)"
                  processingIsRunning={processing.isRunning}
                  onCycleVerdict={onCycleVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {unscoredMaybe.length > 0 && (
          <div>
            <h3 style={sectionTitleStyle('#f59e0b')}>
              ? MAYBE ({unscoredMaybe.length})
              {scoredMaybeCount > 0 && (
                <span
                  style={{
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-mute)',
                    marginLeft: '8px',
                  }}
                >
                  ({scoredMaybeCount} scored)
                </span>
              )}
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '800px',
                overflowY: 'auto',
                paddingRight: '8px',
              }}
            >
              {unscoredMaybe.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="MAYBE"
                  borderColor="rgba(245,158,11,0.2)"
                  processingIsRunning={processing.isRunning}
                  onCycleVerdict={onCycleVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {unscoredNo.length > 0 && (
          <div>
            <h3 style={sectionTitleStyle('#ef4444')}>
              {'\u2717'} NO ({unscoredNo.length} filtered out)
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '600px',
                overflowY: 'auto',
                paddingRight: '8px',
              }}
            >
              {unscoredNo.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="NO"
                  borderColor="rgba(239,68,68,0.2)"
                  processingIsRunning={processing.isRunning}
                  onCycleVerdict={onCycleVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {(unscoredYes.length > 0 || unscoredMaybe.length > 0 || unscoredNo.length > 0) && (
          <div
            style={{
              paddingTop: 'var(--aparture-space-3)',
              borderTop: '1px solid var(--aparture-hairline)',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Filtered:{' '}
              {filterResults.yes.length + filterResults.maybe.length + filterResults.no.length}{' '}
              papers
            </span>
            <span>Remaining to score: {unscoredYes.length + unscoredMaybe.length}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
