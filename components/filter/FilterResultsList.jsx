import { memo, useState } from 'react';
import { FileText, TestTube } from 'lucide-react';
import Card from '../ui/Card.jsx';
import DuplicateBadge from '../ui/DuplicateBadge.jsx';
import ScopedCommentInput from '../feedback/ScopedCommentInput.jsx';
import ReviewGateBanner from '../run/ReviewGateBanner.jsx';
import { ROW_TINT as SHARED_ROW_TINT } from '../ui/ActionPill.jsx';

const BUCKET_PLACEHOLDERS = {
  YES: 'e.g., "Lots of pure theory today — I\'m more interested in applied work this quarter." Or: "Missing the diffusion-model angle I\'ve been tracking — expected 1-2 papers there." Or: "Too many marginal hits — please be stricter about novelty."',
  MAYBE:
    'e.g., "Most of these look like they should have been NO — raise the floor." Or: "I keep wanting to move these to YES — the filter is too cautious here." Or: "MAYBE feels right today — these are genuinely uncertain."',
  NO: 'e.g., "Too aggressive — I\'d expect more of these to reach scoring." Or: "Good rejection bar — these are clearly off-topic." Or: "Lots of borderline ones got filtered — methodology criteria are too strict."',
};

const VERDICT_COLORS = {
  YES: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '#22c55e' },
  MAYBE: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '#f59e0b' },
  NO: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '#ef4444' },
};

// Maps the filter's YES/MAYBE/NO verdict to the shared row-tint palette.
// SHARED_ROW_TINT comes from components/ui/ActionPill.jsx so the three
// review surfaces (filter, score-review, pre-briefing) stay in sync.
const ROW_TINT = {
  YES: SHARED_ROW_TINT.green,
  MAYBE: SHARED_ROW_TINT.amber,
  NO: SHARED_ROW_TINT.mute,
};

function VerdictButton({ option, isActive, disabled, originalVerdict, onClick }) {
  const colors = VERDICT_COLORS[option];
  const wasOriginal = originalVerdict === option;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      // Re-click on the active verdict is a handler no-op (not `disabled`):
      // the active option must stay focusable so keyboard users can land on
      // the radiogroup and arrow/tab through it.
      onClick={isActive ? undefined : onClick}
      title={
        isActive
          ? wasOriginal
            ? `Filter said ${option}`
            : `Currently ${option} (overridden)`
          : `Set verdict to ${option}`
      }
      disabled={disabled}
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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Comment on this paper (optional, no verdict change required)"
        style={{
          width: '100%',
          padding: '6px 10px',
          border: '1px solid var(--aparture-border)',
          borderRadius: '4px',
          fontSize: 'var(--aparture-text-xs, 12px)',
          fontFamily: 'var(--aparture-font-sans, inherit)',
        }}
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

// Token-based comment-button styles, matching the PaperCard comment buttons
// in components/shell/App.jsx (ghost cancel, accent save).
export const COMMENT_CANCEL_BUTTON_STYLE = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  padding: '2px 8px',
  borderRadius: '4px',
  border: '1px solid var(--aparture-hairline)',
  background: 'transparent',
  color: 'var(--aparture-mute)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
};

export const COMMENT_SAVE_BUTTON_STYLE = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  padding: '2px 8px',
  borderRadius: '4px',
  border: '1px solid var(--aparture-accent)',
  background: 'var(--aparture-accent)',
  color: '#fff',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 150ms ease',
};

// Memoized: rows re-render only when their own props change, not on every
// filter-batch progress tick that re-renders the surrounding list.
const FilterResultRow = memo(function FilterResultRow({
  paper,
  verdict,
  borderColor,
  processingIsRunning,
  onSetVerdict,
  onAddPaperComment,
}) {
  const overridden = paper.originalVerdict && paper.originalVerdict !== verdict;

  return (
    <div
      style={{
        background: ROW_TINT[verdict] ?? 'var(--aparture-bg)',
        borderRadius: '4px',
        padding: 'var(--aparture-space-3)',
        border: `1px solid ${borderColor}`,
        opacity: verdict === 'NO' ? 0.55 : 1,
        transition: 'background 150ms ease, opacity 150ms ease',
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
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <span>{paper.title}</span>
            <DuplicateBadge isDuplicate={paper.isDuplicate} firstSeenDate={paper.firstSeenDate} />
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
          {onAddPaperComment && (
            <div style={{ marginTop: '6px' }}>
              <RowComment
                arxivId={paper.arxivId ?? paper.id}
                onAddPaperComment={onAddPaperComment}
              />
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            gap: '4px',
            alignItems: 'center',
          }}
          role="radiogroup"
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
});

export default function FilterResultsList({
  filterResults,
  filterSortedPapers,
  testState,
  processing,
  onSetVerdict,
  bucketFeedbackByBucket,
  onBucketFeedback,
  onAddPaperComment,
  onContinueAfterFilter,
  onSkipRemainingGates,
}) {
  const hasAny =
    filterResults.yes.length > 0 || filterResults.maybe.length > 0 || filterResults.no.length > 0;
  const hasFeedbackProps = onBucketFeedback != null;
  // Still render (for the gate banner) when a continue handler is present, even with no papers/feedback.
  if (!hasAny && !hasFeedbackProps && onContinueAfterFilter == null) return null;

  // Allow verdict overrides during the filter-review pause (the whole
  // point of that gate) even though processing.isRunning is still true.
  const disableOverrides =
    (processing?.isRunning ?? false) && processing?.stage !== 'filter-review';

  // Show ALL papers in each bucket, not just unscored ones. The old
  // layout hid already-scored papers to avoid duplication, but in the
  // sidebar layout filter results and scoring results live on separate
  // views so hiding them just makes the filter output look incomplete.
  const { scoredYesCount, scoredMaybeCount } = filterSortedPapers ?? {
    scoredYesCount: 0,
    scoredMaybeCount: 0,
  };

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
    marginBottom: '4px',
    color,
  });

  const renderBucketFeedback = (bucket) => {
    if (!onBucketFeedback) return null;
    return (
      <div style={{ marginBottom: '8px' }}>
        <ScopedCommentInput
          scope={{ kind: 'bucket', bucket }}
          triggerLabel="+ feedback on this bucket"
          placeholder={BUCKET_PLACEHOLDERS[bucket]}
          savedText={bucketFeedbackByBucket?.[bucket] ?? ''}
          onSave={({ scope, text }) => onBucketFeedback({ bucket: scope.bucket, text })}
        />
      </div>
    );
  };

  return (
    <>
      {/* Gate banner sits ABOVE the card (outermost), matching the other two
          gates — not nested inside it. */}
      {processing?.stage === 'filter-review' && (
        <div style={{ marginBottom: 'var(--aparture-space-4)' }}>
          <ReviewGateBanner
            title="Filter complete — review verdicts before scoring"
            description={`${filterResults.yes.length} YES / ${filterResults.maybe.length} MAYBE / ${filterResults.no.length} NO — override verdicts below, then continue.`}
            continueLabel="Continue to scoring →"
            onContinue={onContinueAfterFilter}
            onSkipRemaining={onSkipRemainingGates}
          />
        </div>
      )}
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
                (Processing batch{' '}
                {Math.min((filterResults.currentBatch || 0) + 1, filterResults.totalBatches || 1)}{' '}
                of {filterResults.totalBatches || 0})
              </span>
            )}
          </h2>
          {testState?.dryRunInProgress && (
            <span style={testBadgeStyle}>
              <TestTube className="w-3 h-3" />
              TEST DATA
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
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
            {renderBucketFeedback('YES')}
            {filterResults.yes.length > 0 && (
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
                    onAddPaperComment={onAddPaperComment}
                  />
                ))}
              </div>
            )}
          </div>

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
            {renderBucketFeedback('MAYBE')}
            {filterResults.maybe.length > 0 && (
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
                    onAddPaperComment={onAddPaperComment}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 style={sectionTitleStyle('#ef4444')}>
              {'\u2717'} NO ({filterResults.no.length} filtered out)
            </h3>
            {renderBucketFeedback('NO')}
            {filterResults.no.length > 0 && (
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
                    onAddPaperComment={onAddPaperComment}
                  />
                ))}
              </div>
            )}
          </div>

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
              <span>
                Remaining to score: {filterResults.yes.length + filterResults.maybe.length}
              </span>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
