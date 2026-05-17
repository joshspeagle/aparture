// components/shell/MainArea.jsx
// Routes activeView to the correct content panel.

import { Unlock } from 'lucide-react';
import BriefingCard from '../briefing/BriefingCard.jsx';
import BriefingView from '../briefing/BriefingView.jsx';
import GenerationDetails from '../briefing/GenerationDetails.jsx';
import PipelineArchiveView from '../briefing/PipelineArchiveView.jsx';
import Button from '../ui/Button.jsx';
import ControlPanel from '../analyzer/ControlPanel.jsx';
import ProgressTimeline from '../run/ProgressTimeline.jsx';
import ReCaptchaSummaryCard from '../run/ReCaptchaSummaryCard.jsx';
import AnalysisResultsList from '../results/AnalysisResultsList.jsx';
import DownloadReportCard from '../results/DownloadReportCard.jsx';
import FeedbackPanel from '../feedback/FeedbackPanel.jsx';
import GeneralCommentInput from '../feedback/GeneralCommentInput.jsx';
import FilterResultsList from '../filter/FilterResultsList.jsx';
import ScoreReviewSurface from '../score-review/ScoreReviewSurface.jsx';
import ScopedCommentInput from '../feedback/ScopedCommentInput.jsx';
import NotebookLMCard from '../notebooklm/NotebookLMCard.jsx';
import YourProfile from '../profile/YourProfile.jsx';
import SettingsPanel from '../settings/SettingsPanel.jsx';
import WelcomeView from '../welcome/WelcomeView.jsx';
import AnalyzedExpander from './AnalyzedExpander.jsx';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';

const PRE_BRIEFING_PLACEHOLDER =
  "e.g., \"Anything to flag about this lineup before we synthesize? — 'Lead with the diffusion-models cluster.' Or: 'These all look strong but I want more methodology depth in the writeup.'\"";

export default function MainArea({
  activeView,
  // For briefing views
  selectedEntry,
  currentBriefing,
  quickSummariesById,
  fullReportsById,
  results,
  feedbackEvents,
  onStar,
  onDismiss,
  onAddComment,
  // For profile view
  profile,
  updateProfile,
  revertToRevision,
  clearHistory,
  migrationNotice,
  dismissMigrationNotice,
  draftContent,
  setDraftContent,
  newFeedback,
  onSuggestClick,
  disabled,
  // For settings view
  config,
  setConfig,
  processing,
  // Pipeline view
  testState,
  processingTiming,
  filterResults,
  filterSortedPapers,
  abstractOnlyPapers,
  renderPaperCard,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onRunDryRun,
  onRunMinimalTest,
  onExport,
  getStageDisplay: _getStageDisplay,
  getProgressPercentage: _getProgressPercentage,
  onSetVerdict,
  bucketFeedbackByBucket,
  onBucketFeedback,
  scoreReviewFeedbackSavedText,
  onScoreReviewFeedback,
  onAddPaperComment,
  onSkipRemainingGates,
  onContinueAfterFilter,
  onContinueAfterScoreReview,
  onContinueAfterReview,
  msStarredIds,
  msDismissedIds,
  onMSStar,
  onMSDismiss,
  // Briefing card (generate button)
  synthesizing,
  synthesisError,
  briefingCheckResult,
  briefingStage,
  onGenerateBriefing,
  // Feedback panel
  feedbackCutoff,
  lastFeedbackCutoff,
  runFeedbackSavedText,
  onRunFeedback,
  onAddGeneralComment,
  onPromotePaper,
  // NotebookLM
  podcastDuration,
  setPodcastDuration,
  notebookLMModel,
  setNotebookLMModel,
  notebookLMGenerating,
  notebookLMStatus,
  notebookLMContent,
  onGenerateNotebookLM,
  // Navigation (for paired briefing ↔ pipeline views)
  onNavigate,
  // Logout
  onLogout,
}) {
  // End-of-run summary: papers skipped because Playwright isn't installed.
  // Read once so the pipeline view can render ReCaptchaSummaryCard below
  // DownloadReportCard.
  const skippedDueToRecaptcha = useAnalyzerStore((s) => s.skippedDueToRecaptcha);

  // Profile view
  if (activeView === 'profile') {
    return (
      <div className="config-surface">
        <YourProfile
          profile={profile}
          updateProfile={updateProfile}
          migrationNotice={migrationNotice}
          dismissMigrationNotice={dismissMigrationNotice}
          revertToRevision={revertToRevision}
          clearHistory={clearHistory}
          newFeedback={newFeedback}
          onSuggestClick={onSuggestClick}
          draftContent={draftContent}
          setDraftContent={setDraftContent}
          disabled={disabled}
        />
      </div>
    );
  }

  // Settings view
  if (activeView === 'settings') {
    return (
      <div className="config-surface">
        <SettingsPanel config={config} setConfig={setConfig} processing={processing} />
        {/* Logout button at bottom of settings */}
        <div style={{ marginTop: 'var(--aparture-space-6)' }}>
          <button
            onClick={onLogout}
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              color: 'var(--aparture-ink)',
              background: 'var(--aparture-surface)',
              border: '1px solid var(--aparture-hairline)',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 150ms ease',
            }}
          >
            <Unlock className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Pipeline view — ProgressTimeline + ControlPanel + results + reports.
  if (activeView === 'pipeline') {
    return (
      <div className="config-surface">
        <ProgressTimeline
          onSetVerdict={onSetVerdict}
          pauseAfterFilter={config?.pauseAfterFilter ?? true}
          pauseBeforeBriefing={config?.pauseBeforeBriefing ?? true}
          onContinueAfterFilter={onContinueAfterFilter}
          onContinueAfterReview={onContinueAfterReview}
          onSkipRemainingGates={onSkipRemainingGates}
        >
          {/* Controls */}
          <div style={{ marginTop: 'var(--aparture-space-6)' }}>
            <ControlPanel
              processing={processing}
              testState={testState}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              onReset={onReset}
              onRunDryRun={onRunDryRun}
              onRunMinimalTest={onRunMinimalTest}
            />
          </div>

          {/* Filter results — first stage output, shown near the top */}
          <FilterResultsList
            filterResults={filterResults}
            filterSortedPapers={filterSortedPapers}
            testState={testState}
            processing={processing}
            onSetVerdict={onSetVerdict}
            bucketFeedbackByBucket={bucketFeedbackByBucket}
            onBucketFeedback={onBucketFeedback}
            onAddPaperComment={onAddPaperComment}
          />

          {/* Score-review gate surface — shown when pipeline is paused at 'score-review' */}
          {processing.stage === 'score-review' && results.availablePapers && (
            <div style={{ marginTop: 'var(--aparture-space-4)' }}>
              <ScoreReviewSurface
                availablePapers={results.availablePapers}
                maxDeepAnalysis={config?.maxDeepAnalysis ?? 10}
                starredIds={msStarredIds}
                dismissedIds={msDismissedIds}
                onStar={onMSStar}
                onDismiss={onMSDismiss}
                onContinue={onContinueAfterScoreReview}
                onSkipRemaining={onSkipRemainingGates}
                scopedCommentInput={
                  <ScopedCommentInput
                    scope={{ kind: 'score-review' }}
                    triggerLabel="+ feedback on this scoring round"
                    placeholder='e.g., "Lots of pure theory today — I would promote the applied papers over the strict-relevance ranking." Or: "Top-N looks right but I think paper N+3 is a sleeper — starring it." Or: "Scoring spread is too compressed; many borderline ones look genuinely interesting."'
                    savedText={scoreReviewFeedbackSavedText}
                    onSave={onScoreReviewFeedback}
                  />
                }
              />
            </div>
          )}

          {/* Scored / analyzed papers */}
          <AnalysisResultsList
            results={results}
            testState={testState}
            processing={processing}
            abstractOnlyPapers={abstractOnlyPapers}
            renderPaperCard={renderPaperCard}
          />

          {/* Pre-briefing expander — cut papers that were analyzed but didn't make finalRanking */}
          {processing.stage === 'pre-briefing-review' &&
            results.allAnalyzedPapers &&
            results.allAnalyzedPapers.length > (results.finalRanking?.length ?? 0) && (
              <AnalyzedExpander
                allAnalyzedPapers={results.allAnalyzedPapers}
                finalRanking={results.finalRanking ?? []}
                renderPaperCard={renderPaperCard}
                onPromotePaper={onPromotePaper}
              />
            )}

          {/* Pre-briefing general comment — shown when pipeline is paused at pre-briefing-review */}
          {processing.stage === 'pre-briefing-review' && (
            <div style={{ marginTop: 'var(--aparture-space-4, 16px)' }}>
              <GeneralCommentInput
                onSave={(text) => onAddGeneralComment?.(text, undefined)}
                placeholder={PRE_BRIEFING_PLACEHOLDER}
              />
            </div>
          )}

          {/* Report download + briefing generation */}
          <DownloadReportCard
            testState={testState}
            processingTiming={processingTiming}
            results={results}
            processing={processing}
            config={config}
            onExport={onExport}
          />

          {/* End-of-run summary for papers skipped when Playwright is
              unavailable. Returns null when empty. */}
          <ReCaptchaSummaryCard skipped={skippedDueToRecaptcha} />

          <BriefingCard
            results={results}
            testState={testState}
            synthesizing={synthesizing}
            synthesisError={synthesisError}
            briefingCheckResult={briefingCheckResult}
            briefingStage={briefingStage}
            processing={processing}
            onGenerate={onGenerateBriefing}
          />
        </ProgressTimeline>
      </div>
    );
  }

  // Welcome view
  if (activeView === 'welcome') {
    return (
      <div className="briefing-surface">
        <WelcomeView />
      </div>
    );
  }

  // Pipeline details view — paired with a briefing via "pipeline:<id>"
  if (activeView.startsWith('pipeline:')) {
    const entryKey = activeView.slice('pipeline:'.length);
    // selectedEntry is async-resolved by App's useSelectedBriefing effect.
    if (!selectedEntry || selectedEntry.id !== entryKey) {
      return (
        <div className="briefing-surface">
          <p style={{ color: 'var(--aparture-mute)', fontFamily: 'var(--aparture-font-sans)' }}>
            Loading…
          </p>
        </div>
      );
    }
    return (
      <PipelineArchiveView
        entry={selectedEntry}
        onBack={() => onNavigate?.(`briefing:${entryKey}`)}
      />
    );
  }

  // Briefing view — matched by "briefing:<id>" pattern
  if (activeView.startsWith('briefing:')) {
    const entryKey = activeView.slice('briefing:'.length);
    // selectedEntry is async-resolved by App's useSelectedBriefing effect.
    // While loading (or during a view switch) selectedEntry may be null or
    // stale; show a loading shim until it matches.
    if (!selectedEntry || selectedEntry.id !== entryKey) {
      return (
        <div className="briefing-surface">
          <p style={{ color: 'var(--aparture-mute)', fontFamily: 'var(--aparture-font-sans)' }}>
            Loading…
          </p>
        </div>
      );
    }
    const entry = selectedEntry;

    return (
      <div className="briefing-surface">
        <BriefingView
          briefing={entry.briefing}
          date={new Date(entry.date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          briefingDate={entry.date}
          papersScreened={results?.allPapers?.length ?? 0}
          quickSummariesById={{ ...entry.quickSummariesById, ...quickSummariesById }}
          fullReportsById={{ ...entry.fullReportsById, ...fullReportsById }}
          feedbackEvents={feedbackEvents}
          onStar={onStar}
          onDismiss={onDismiss}
          onAddComment={onAddComment}
        />

        <GenerationDetails generationMetadata={entry.generationMetadata} />

        {entry.pipelineArchive && (
          <div style={{ marginTop: 'var(--aparture-space-4)' }}>
            <Button variant="ghost" onClick={() => onNavigate?.(`pipeline:${entry.id}`)}>
              View pipeline details →
            </Button>
          </div>
        )}

        {/* Feedback panel below briefing */}
        <div id="feedback-panel" style={{ marginTop: 'var(--aparture-space-6)' }}>
          <FeedbackPanel
            events={feedbackEvents}
            cutoff={feedbackCutoff}
            briefingId={entry.id}
            onAddGeneralComment={onAddGeneralComment}
            onSuggestClick={onSuggestClick}
            lastFeedbackCutoff={lastFeedbackCutoff}
            runFeedbackSavedText={runFeedbackSavedText}
            onRunFeedback={onRunFeedback}
          />
        </div>

        {/* NotebookLM card below feedback */}
        <div style={{ marginTop: 'var(--aparture-space-6)' }}>
          <NotebookLMCard
            currentBriefing={currentBriefing}
            podcastDuration={podcastDuration}
            setPodcastDuration={setPodcastDuration}
            notebookLMModel={notebookLMModel}
            setNotebookLMModel={setNotebookLMModel}
            notebookLMGenerating={notebookLMGenerating}
            notebookLMStatus={notebookLMStatus}
            notebookLMContent={notebookLMContent}
            onGenerateNotebookLM={onGenerateNotebookLM}
            processing={processing}
          />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
