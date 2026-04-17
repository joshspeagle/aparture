import { FileText, TestTube } from 'lucide-react';
import Card from '../ui/Card.jsx';

const VERDICT_COLORS = {
  YES: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '#22c55e' },
  MAYBE: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '#f59e0b' },
  NO: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '#ef4444' },
};

function VerdictButton({ option, isActive, disabled, originalVerdict, onClick }) {
  const colors = VERDICT_COLORS[option];
  const wasOriginal = originalVerdict === option;
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        isActive
          ? wasOriginal
            ? `Filter said ${option}`
            : `Currently ${option} (overridden)`
          : `Set verdict to ${option}`
      }
      disabled={disabled || isActive}
      style={{
        padding: '2px 8px',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: '9999px',
        border: `1px solid ${isActive ? colors.border : 'var(--aparture-hairline)'}`,
        background: isActive ? colors.bg : 'transparent',
        color: isActive ? colors.color : 'var(--aparture-mute)',
        cursor: disabled ? 'not-allowed' : isActive ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'var(--aparture-font-sans)',
        fontWeight: isActive ? 600 : 400,
        transition: 'all 150ms ease',
      }}
    >
      {option}
      {isActive && wasOriginal === false && originalVerdict && (
        <span style={{ marginLeft: '4px' }}>{'\u21C4'}</span>
      )}
    </button>
  );
}

function FilterResultRow({ paper, verdict, borderColor, processingIsRunning, onSetVerdict }) {
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
            {(paper.authors?.length ?? 0) > 2
              ? `${paper.authors[0]} et al.`
              : (paper.authors ?? []).join(', ')}
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
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            gap: '4px',
            alignItems: 'center',
          }}
          aria-label={
            overridden
              ? `Currently ${verdict} (filter said ${paper.originalVerdict}). Click YES, MAYBE, or NO to change.`
              : `Currently ${verdict}. Click YES, MAYBE, or NO to override.`
          }
        >
          {['YES', 'MAYBE', 'NO'].map((option) => (
            <VerdictButton
              key={option}
              option={option}
              isActive={option === verdict}
              disabled={processingIsRunning}
              originalVerdict={paper.originalVerdict}
              onClick={() => onSetVerdict(paper.id, verdict, option)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FilterResultsList({
  filterResults,
  filterSortedPapers,
  testState,
  processing,
  onSetVerdict,
}) {
  const hasAny =
    filterResults.yes.length > 0 || filterResults.maybe.length > 0 || filterResults.no.length > 0;
  if (!hasAny) return null;

  // Allow verdict overrides during the filter-review pause (the whole
  // point of that gate) even though processing.isRunning is still true.
  const disableOverrides = processing.isRunning && processing.stage !== 'filter-review';

  // Show ALL papers in each bucket, not just unscored ones. The old
  // layout hid already-scored papers to avoid duplication, but in the
  // sidebar layout filter results and scoring results live on separate
  // views so hiding them just makes the filter output look incomplete.
  const { scoredYesCount, scoredMaybeCount } = filterSortedPapers;

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
        {filterResults.yes.length > 0 && (
          <div>
            <h3 style={sectionTitleStyle('#22c55e')}>
              {'\u2713'} YES ({filterResults.yes.length})
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
              {filterResults.yes.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="YES"
                  borderColor="rgba(34,197,94,0.2)"
                  processingIsRunning={disableOverrides}
                  onSetVerdict={onSetVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {filterResults.maybe.length > 0 && (
          <div>
            <h3 style={sectionTitleStyle('#f59e0b')}>
              ? MAYBE ({filterResults.maybe.length})
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
              {filterResults.maybe.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="MAYBE"
                  borderColor="rgba(245,158,11,0.2)"
                  processingIsRunning={disableOverrides}
                  onSetVerdict={onSetVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {filterResults.no.length > 0 && (
          <div>
            <h3 style={sectionTitleStyle('#ef4444')}>
              {'\u2717'} NO ({filterResults.no.length} filtered out)
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
              {filterResults.no.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="NO"
                  borderColor="rgba(239,68,68,0.2)"
                  processingIsRunning={disableOverrides}
                  onSetVerdict={onSetVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {(filterResults.yes.length > 0 ||
          filterResults.maybe.length > 0 ||
          filterResults.no.length > 0) && (
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
            <span>Remaining to score: {filterResults.yes.length + filterResults.maybe.length}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
