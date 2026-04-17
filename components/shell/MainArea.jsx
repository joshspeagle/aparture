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
import AnalysisResultsList from '../results/AnalysisResultsList.jsx';
import DownloadReportCard from '../results/DownloadReportCard.jsx';
import FeedbackPanel from '../feedback/FeedbackPanel.jsx';
import FilterResultsList from '../filter/FilterResultsList.jsx';
import NotebookLMCard from '../notebooklm/NotebookLMCard.jsx';
import YourProfile from '../profile/YourProfile.jsx';
import SettingsPanel from '../settings/SettingsPanel.jsx';
import WelcomeView from '../welcome/WelcomeView.jsx';

export default function MainArea({
  activeView,
  // For briefing views
  briefingHistory,
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
  onContinueAfterFilter,
  onContinueAfterReview,
  // Briefing card (generate button)
  synthesizing,
  synthesisError,
  briefingCheckResult,
  briefingStage,
  onGenerateBriefing,
  // Feedback panel
  feedbackCutoff,
  onAddGeneralComment,
  // NotebookLM
  podcastDuration,
  setPodcastDuration,
  notebookLMModel,
  setNotebookLMModel,
  notebookLMGenerating,
  notebookLMStatus,
  notebookLMContent,
  enableHallucinationCheck,
  setEnableHallucinationCheck,
  hallucinationWarning,
  onGenerateNotebookLM,
  onDownloadNotebookLM,
  // Navigation (for paired briefing ↔ pipeline views)
  onNavigate,
  // Logout
  onLogout,
}) {
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
      <div className="config-surface" style={{ maxWidth: '900px' }}>
        <ProgressTimeline
          onSetVerdict={onSetVerdict}
          pauseAfterFilter={config?.pauseAfterFilter ?? true}
          pauseBeforeBriefing={config?.pauseBeforeBriefing ?? true}
          onContinueAfterFilter={onContinueAfterFilter}
          onContinueAfterReview={onContinueAfterReview}
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
          />

          {/* Scored / analyzed papers */}
          <AnalysisResultsList
            results={results}
            testState={testState}
            processing={processing}
            abstractOnlyPapers={abstractOnlyPapers}
            renderPaperCard={renderPaperCard}
          />

          {/* Report download + briefing generation */}
          <DownloadReportCard
            testState={testState}
            processingTiming={processingTiming}
            results={results}
            processing={processing}
            config={config}
            onExport={onExport}
          />

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
    const entry = briefingHistory?.find((b) => b.id === entryKey);
    return (
      <PipelineArchiveView entry={entry} onBack={() => onNavigate?.(`briefing:${entryKey}`)} />
    );
  }

  // Briefing view — matched by "briefing:<id>" pattern
  if (activeView.startsWith('briefing:')) {
    const entryKey = activeView.slice('briefing:'.length);
    const entry = briefingHistory?.find((b) => b.id === entryKey);

    if (!entry) {
      return (
        <div className="briefing-surface">
          <p
            style={{
              color: 'var(--aparture-mute)',
              fontFamily: 'var(--aparture-font-sans)',
            }}
          >
            No briefing found for {entryKey}.
          </p>
        </div>
      );
    }

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
            onAddGeneralComment={onAddGeneralComment}
            onSuggestClick={onSuggestClick}
          />
        </div>

        {/* NotebookLM card below feedback */}
        <div style={{ marginTop: 'var(--aparture-space-6)' }}>
          <NotebookLMCard
            currentBriefing={currentBriefing}
            testState={testState}
            podcastDuration={podcastDuration}
            setPodcastDuration={setPodcastDuration}
            notebookLMModel={notebookLMModel}
            setNotebookLMModel={setNotebookLMModel}
            notebookLMGenerating={notebookLMGenerating}
            notebookLMStatus={notebookLMStatus}
            notebookLMContent={notebookLMContent}
            enableHallucinationCheck={enableHallucinationCheck}
            setEnableHallucinationCheck={setEnableHallucinationCheck}
            hallucinationWarning={hallucinationWarning}
            results={results}
            onGenerate={onGenerateNotebookLM}
            onDownload={onDownloadNotebookLM}
          />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
