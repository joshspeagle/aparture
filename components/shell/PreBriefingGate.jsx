// components/shell/PreBriefingGate.jsx
// Pre-briefing review gate (Gate 3). Rendered by MainArea when the pipeline
// pauses at stage 'pre-briefing-review'. Mirrors ScoreReviewSurface (score
// gate) and FilterResultsList (filter gate) as a self-contained section
// component fronted by the shared ReviewGateBanner.

import ReviewGateBanner from '../run/ReviewGateBanner.jsx';
import GeneralCommentInput from '../feedback/GeneralCommentInput.jsx';
import AnalyzedExpander from './AnalyzedExpander.jsx';

const PRE_BRIEFING_PLACEHOLDER =
  "e.g., \"Anything to flag about this lineup before we synthesize? — 'Lead with the diffusion-models cluster.' Or: 'These all look strong but I want more methodology depth in the writeup.'\"";

/**
 * @param {{
 *   results: { allAnalyzedPapers?: Array<object>, finalRanking?: Array<object> },
 *   renderPaperCard: (paper: object, idx: number, showDeepAnalysis: boolean) => React.ReactNode,
 *   onPromotePaper?: (paper: object) => void,
 *   onContinueAfterReview: () => void,
 *   onSkipRemainingGates?: () => void,
 *   onAddGeneralComment?: (text: string, briefingId: string | undefined) => void,
 * }} props
 */
export default function PreBriefingGate({
  results,
  renderPaperCard,
  onPromotePaper,
  onContinueAfterReview,
  onSkipRemainingGates,
  onAddGeneralComment,
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
      <ReviewGateBanner
        title="Analysis complete — review before briefing"
        description="Review results and add stars/dismissals before generating your briefing."
        continueLabel="Continue to briefing →"
        onContinue={onContinueAfterReview}
        onSkipRemaining={onSkipRemainingGates}
      />
      {results.allAnalyzedPapers &&
        results.allAnalyzedPapers.length > (results.finalRanking?.length ?? 0) && (
          <AnalyzedExpander
            allAnalyzedPapers={results.allAnalyzedPapers}
            finalRanking={results.finalRanking ?? []}
            renderPaperCard={renderPaperCard}
            onPromotePaper={onPromotePaper}
          />
        )}
      <GeneralCommentInput
        onSave={(text) => onAddGeneralComment?.(text, undefined)}
        placeholder={PRE_BRIEFING_PLACEHOLDER}
      />
    </section>
  );
}
