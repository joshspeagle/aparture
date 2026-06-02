// components/shell/PreBriefingGate.jsx
// Pre-briefing review gate (Gate 3). Rendered by MainArea when the pipeline
// pauses at stage 'pre-briefing-review'. Mirrors ScoreReviewSurface (score
// gate) and FilterResultsList (filter gate): the shared ReviewGateBanner sits
// at the HEAD of the reviewed content. Because that content — the analyzed-
// papers list (AnalysisResultsList) — is shared across stages, MainArea passes
// it in as `children` so the banner heads it rather than trailing below it.
// The cut-papers expander trails after the list.

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
 *   children?: React.ReactNode,  // the reviewed content (AnalysisResultsList), headed by the banner
 * }} props
 */
export default function PreBriefingGate({
  results,
  renderPaperCard,
  onPromotePaper,
  onContinueAfterReview,
  onSkipRemainingGates,
  onAddGeneralComment,
  children,
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
      <ReviewGateBanner
        title="Analysis complete — review before briefing"
        description="Review results and add stars/dismissals before generating your briefing."
        continueLabel="Continue to briefing →"
        onContinue={onContinueAfterReview}
        onSkipRemaining={onSkipRemainingGates}
      >
        {/* Per-round free-text feedback lives inside the banner, matching the
            score-review gate's scoped-feedback placement. */}
        <GeneralCommentInput
          onSave={(text) => onAddGeneralComment?.(text, undefined)}
          placeholder={PRE_BRIEFING_PLACEHOLDER}
        />
      </ReviewGateBanner>
      {children}
      {results.allAnalyzedPapers && (
        <AnalyzedExpander
          allAnalyzedPapers={results.allAnalyzedPapers}
          finalRanking={results.finalRanking ?? []}
          renderPaperCard={renderPaperCard}
          onPromotePaper={onPromotePaper}
        />
      )}
    </section>
  );
}
