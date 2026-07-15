// components/shell/PreBriefingGate.jsx
// Pre-briefing review gate (Gate 3). Rendered by MainArea when the pipeline
// pauses at stage 'pre-briefing-review'. Mirrors ScoreReviewSurface (score
// gate) and FilterResultsList (filter gate): the shared ReviewGateBanner sits
// at the HEAD of the reviewed content. Because that content — the analyzed-
// papers list (AnalysisResultsList) — is shared across stages, MainArea passes
// it in as `children` so the banner heads it rather than trailing below it.
// The cut-papers expander trails after the list.

import { useMemo } from 'react';
import ReviewGateBanner from '../run/ReviewGateBanner.jsx';
import GeneralCommentInput from '../feedback/GeneralCommentInput.jsx';
import AnalyzedExpander from './AnalyzedExpander.jsx';
import { estimateRunCost, formatUsd } from '../../lib/analyzer/costEstimate.js';

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
 *   config?: object,             // pipeline config; enables the projected-spend line
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
  config,
  children,
}) {
  // Projected spend of the stage this gate is holding back: quick summaries
  // (quickSummaryModel) + synthesis and the hallucination check
  // (briefingModel), over the papers currently in the final ranking. Hidden
  // when either model has no registry pricing (never show "$null").
  const briefingPaperCount = results.finalRanking?.length ?? 0;
  // Memoized: the estimate only depends on the paper count and model config,
  // not on the expander/comment interactions that re-render the gate.
  const costLine = useMemo(() => {
    const est =
      config && briefingPaperCount > 0
        ? estimateRunCost({
            counts: { quickSummary: briefingPaperCount, briefing: briefingPaperCount },
            config,
          })
        : null;
    return est && !est.hasUnknownPricing && est.total != null
      ? `Briefing over ${briefingPaperCount} paper${briefingPaperCount === 1 ? '' : 's'} — est. ${formatUsd(est.total)}`
      : null;
  }, [briefingPaperCount, config]);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
      <ReviewGateBanner
        title="Analysis complete — review before briefing"
        description="Review results and add stars/dismissals before generating your briefing."
        continueLabel="Continue to briefing →"
        onContinue={onContinueAfterReview}
        onSkipRemaining={onSkipRemainingGates}
      >
        {costLine && (
          <div
            style={{
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2, 8px)',
            }}
          >
            {costLine}
          </div>
        )}
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
