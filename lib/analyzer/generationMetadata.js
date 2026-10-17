// Shared builder for a briefing's persisted generationMetadata.
//
// Used by BOTH briefing-generation entry points — the pipeline's auto-run
// (lib/analyzer/stages/startProcessing.js) and the manual "Generate Briefing"
// button (components/shell/App.jsx) — so the two can never drift on which
// fields get persisted. The metadata rides along with the saved briefing
// entry (hooks/useBriefing.js) and is what BriefingView / GenerationDetails
// read for archived briefings.

import { DEFAULT_MODEL_ID } from '../../utils/models.js';

/**
 * @param {Object} args
 * @param {Object} args.config          analyzer config (model slots, toggles)
 * @param {Object} args.profile         useProfile value ({content, lastFeedbackCutoff})
 * @param {Object} args.filterResults   filter buckets ({yes, maybe, no} arrays)
 * @param {number} args.papersScreened  Stage-1 paper count for THIS run
 * @param {boolean} args.testMode       true when the results came from a dry run
 * @param {boolean} [args.minimalTest]  true when the run used the fixed TEST_PAPERS
 */
export function buildGenerationMetadata({
  config,
  profile,
  filterResults,
  papersScreened,
  testMode,
  minimalTest = false,
}) {
  const resolvedBriefingModel = config?.briefingModel ?? config?.pdfModel ?? DEFAULT_MODEL_ID;
  return {
    // Persisted so archived dry-run briefings stay identifiable as mock
    // data after testState.dryRunInProgress flips back to false.
    testMode: !!testMode,
    // A minimal test makes real calls (so no "mock data" badge) over the
    // fixed TEST_PAPERS: still a test run, which the briefing history trims
    // before real briefings (see buildIndexEntry / useBriefing).
    ...(minimalTest ? { minimalTest: true } : {}),
    profileSnapshot: profile?.content ?? '',
    filterModel: config?.filterModel ?? '',
    scoringModel: config?.scoringModel ?? '',
    pdfModel: config?.pdfModel ?? '',
    briefingModel: resolvedBriefingModel,
    categories: [...(config?.selectedCategories ?? [])],
    filterVerdictCounts: {
      yes: filterResults?.yes?.length ?? 0,
      maybe: filterResults?.maybe?.length ?? 0,
      no: filterResults?.no?.length ?? 0,
    },
    // Persisted so archived briefings show THEIR run's screened count
    // (BriefingView reads this instead of the live results slice).
    papersScreened: papersScreened ?? 0,
    feedbackCutoff: profile?.lastFeedbackCutoff ?? null,
    briefingRetryOnYes: config?.briefingRetryOnYes ?? true,
    briefingRetryOnMaybe: config?.briefingRetryOnMaybe ?? false,
    pauseAfterFilter: config?.pauseAfterFilter ?? true,
    pauseBeforeBriefing: config?.pauseBeforeBriefing ?? true,
    timestamp: new Date().toISOString(),
  };
}
