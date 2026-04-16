// components/shell/MainArea.jsx
// Routes activeView to the correct content panel.

import { Unlock } from 'lucide-react';
import BriefingCard from '../briefing/BriefingCard.jsx';
import BriefingView from '../briefing/BriefingView.jsx';
import ControlPanel from '../analyzer/ControlPanel.jsx';
import ProgressTracker from '../analyzer/ProgressTracker.jsx';
import AnalysisResultsList from '../results/AnalysisResultsList.jsx';
import DownloadReportCard from '../results/DownloadReportCard.jsx';
import FeedbackPanel from '../feedback/FeedbackPanel.jsx';
import FilterResultsList from '../filter/FilterResultsList.jsx';
import NotebookLMCard from '../notebooklm/NotebookLMCard.jsx';
import YourProfile from '../profile/YourProfile.jsx';
import PreviewPanel from '../profile/PreviewPanel.jsx';
import SettingsPanel from '../settings/SettingsPanel.jsx';

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
  newInteractionCount,
  onScrollToFeedback,
  onPreviewClick,
  onSuggestClick,
  disabled,
  showPreviewPanel,
  previewPanelProps,
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
  getStageDisplay,
  getProgressPercentage,
  onCycleVerdict,
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
          newInteractionCount={newInteractionCount}
          onScrollToFeedback={onScrollToFeedback}
          onPreviewClick={onPreviewClick}
          onSuggestClick={onSuggestClick}
          draftContent={draftContent}
          setDraftContent={setDraftContent}
          disabled={disabled}
        />
        {showPreviewPanel && <PreviewPanel {...previewPanelProps} />}
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
            className="px-3 py-2 bg-slate-700 rounded-lg font-medium hover:bg-slate-600 transition-colors flex items-center gap-2 text-sm"
            style={{ color: 'var(--aparture-ink)' }}
          >
            <Unlock className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Pipeline view — ControlPanel, ProgressTracker, results, reports,
  // filter results. This is a temporary view that will be replaced by
  // the ProgressTimeline in core-2.
  if (activeView === 'pipeline') {
    return (
      <div className="config-surface" style={{ maxWidth: '900px' }}>
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

        <ProgressTracker
          processing={processing}
          testState={testState}
          getStageDisplay={getStageDisplay}
          getProgressPercentage={getProgressPercentage}
        />

        <AnalysisResultsList
          results={results}
          testState={testState}
          processing={processing}
          abstractOnlyPapers={abstractOnlyPapers}
          renderPaperCard={renderPaperCard}
        />

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

        <FilterResultsList
          filterResults={filterResults}
          filterSortedPapers={filterSortedPapers}
          testState={testState}
          processing={processing}
          onCycleVerdict={onCycleVerdict}
        />
      </div>
    );
  }

  // Welcome view (placeholder — full WelcomeView is Task 7)
  if (activeView === 'welcome') {
    return (
      <div className="briefing-surface">
        <h1
          style={{
            fontFamily: 'var(--aparture-font-serif)',
            fontSize: 'var(--aparture-text-2xl)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
          }}
        >
          Welcome to{' '}
          <span>
            ap<span style={{ color: 'var(--aparture-accent)' }}>ar</span>ture
          </span>
        </h1>
        <p
          style={{
            fontFamily: 'var(--aparture-font-serif)',
            fontSize: 'var(--aparture-text-base)',
            lineHeight: 1.65,
            color: 'var(--aparture-ink)',
            marginTop: 'var(--aparture-space-4)',
          }}
        >
          A research-paper discovery tool for arXiv. Click <strong>+ New Briefing</strong> in the
          sidebar to get started.
        </p>
      </div>
    );
  }

  // Briefing view — matched by "briefing:<date>" pattern
  if (activeView.startsWith('briefing:')) {
    const dateKey = activeView.slice('briefing:'.length);
    const entry = briefingHistory?.find((b) => b.date === dateKey);

    if (!entry) {
      return (
        <div className="briefing-surface">
          <p
            style={{
              color: 'var(--aparture-mute)',
              fontFamily: 'var(--aparture-font-sans)',
            }}
          >
            No briefing found for {dateKey}.
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
          quickSummariesById={quickSummariesById}
          fullReportsById={fullReportsById}
          feedbackEvents={feedbackEvents}
          onStar={onStar}
          onDismiss={onDismiss}
          onAddComment={onAddComment}
        />

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
