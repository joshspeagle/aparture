// components/shell/MainArea.jsx
// Routes activeView to the correct content panel.

import BriefingView from '../briefing/BriefingView.jsx';
import YourProfile from '../profile/YourProfile.jsx';
import PreviewPanel from '../profile/PreviewPanel.jsx';
import SettingsPanel from '../settings/SettingsPanel.jsx';

export default function MainArea({
  activeView,
  // For briefing views
  briefingHistory,
  currentBriefing: _currentBriefing,
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
  saveSuggested: _saveSuggested,
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
  // For briefing card (generate button) — wired up in later tasks
  synthesizing: _synthesizing,
  synthesisError: _synthesisError,
  briefingCheckResult: _briefingCheckResult,
  briefingStage: _briefingStage,
  onGenerateBriefing: _onGenerateBriefing,
  // For running state — wired up in later tasks
  testState: _testState,
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
      </div>
    );
  }

  // Fallback
  return null;
}
