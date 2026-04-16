// components/shell/App.jsx
// Root application shell — replaces ArxivAnalyzer as the top-level component.
// Owns all state management (hooks, store, pipeline, persistence) and renders
// a sidebar + main-area layout instead of the old vertical scroll stack.

import { Lock } from 'lucide-react';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_REGISTRY } from '../../utils/models';
import { runBriefingGeneration } from '../../lib/analyzer/briefingClient.js';
import { downloadBlob, exportAnalysisReport } from '../../lib/analyzer/exportReport.js';
import { createAnalysisPipeline } from '../../lib/analyzer/pipeline.js';
import { readInitialConfig, useAnalyzerPersistence } from '../../hooks/useAnalyzerPersistence.js';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import { useProfile } from '../../hooks/useProfile.js';
import { useBriefing } from '../../hooks/useBriefing.js';
import { useFeedback } from '../../hooks/useFeedback.js';
import Sidebar from './Sidebar.jsx';
import MainArea from './MainArea.jsx';
import SuggestDialog from '../profile/SuggestDialog.jsx';

// Phase 1.5.1 D5 fix: PaperCard hoisted to module scope so React can reconcile
// cards across re-renders rather than unmount/remount them (which would destroy
// the inline comment textarea state during active scoring / progress ticks).
// All closure-captured data (feedback state, callbacks, briefing date) is now
// passed explicitly as props.
function PaperCard({
  paper,
  idx,
  showDeepAnalysis,
  starred,
  dismissed,
  briefingDate,
  onStar,
  onDismiss,
  onComment,
}) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');

  const hasFeedbackAffordance = showDeepAnalysis && paper.deepAnalysis;
  const arxivId = paper.id;

  const buildPaperMeta = () => ({
    arxivId,
    paperTitle: paper.title,
    quickSummary: paper.deepAnalysis?.summary ?? paper.scoreJustification ?? '',
    score: paper.finalScore ?? paper.relevanceScore ?? 0,
    briefingDate,
  });

  const handleStar = () => onStar?.(buildPaperMeta());
  const handleDismiss = () => onDismiss?.(buildPaperMeta());
  const handleSaveComment = () => {
    const text = commentText.trim();
    if (text) onComment?.(buildPaperMeta(), text);
    setCommentText('');
    setShowCommentInput(false);
  };
  const handleCancelComment = () => {
    setCommentText('');
    setShowCommentInput(false);
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
              #{idx + 1}
            </span>
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
              Score: {(paper.finalScore || paper.relevanceScore).toFixed(1)}/10
            </span>
            {paper.scoreAdjustment && Math.abs(paper.scoreAdjustment) > 0.1 && (
              <span
                className={`text-xs px-2 py-1 rounded ${
                  paper.scoreAdjustment > 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}
                title={paper.adjustmentReason}
              >
                {paper.scoreAdjustment > 0 ? '\u2191' : '\u2193'}{' '}
                {Math.abs(paper.scoreAdjustment).toFixed(1)}
              </span>
            )}
            {showDeepAnalysis && paper.deepAnalysis && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                PDF Analyzed
              </span>
            )}
            <a
              href={`https://arxiv.org/abs/${paper.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-slate-700 text-gray-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors"
            >
              arXiv:{paper.id}
            </a>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">{paper.title}</h3>
          <p className="text-sm text-gray-400 mb-2">
            {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
          </p>
          <p className="text-sm text-gray-300 italic mb-2">
            {paper.deepAnalysis?.relevanceAssessment || paper.scoreJustification}
          </p>
          {showDeepAnalysis && paper.deepAnalysis && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {paper.deepAnalysis.summary}
              </div>
            </div>
          )}

          {hasFeedbackAffordance && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleStar}
                  className={`px-2 py-1 rounded border transition-colors ${
                    starred
                      ? 'bg-yellow-900/40 text-yellow-300 border-yellow-600'
                      : 'text-slate-400 border-slate-600 hover:border-yellow-500 hover:text-yellow-300'
                  }`}
                  title={starred ? 'Remove star' : 'Star this paper'}
                >
                  {starred ? '\u2605 starred' : '\u2606 star'}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className={`px-2 py-1 rounded border transition-colors ${
                    dismissed
                      ? 'bg-slate-800 text-slate-100 border-slate-500'
                      : 'text-slate-400 border-slate-600 hover:border-slate-400 hover:text-slate-200'
                  }`}
                  title={dismissed ? 'Remove dismiss' : 'Dismiss this paper'}
                >
                  {dismissed ? '\u2298 dismissed' : '\u2298 dismiss'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommentInput((v) => !v)}
                  className="px-2 py-1 rounded border text-slate-400 border-slate-600 hover:border-purple-500 hover:text-purple-300 transition-colors"
                  title="Leave a comment on this paper"
                >
                  + comment
                </button>
              </div>
              {showCommentInput && (
                <div className="mt-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                    placeholder="Your thoughts on this paper\u2026"
                    className="w-full min-h-[4rem] resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-slate-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="mt-1 flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelComment}
                      className="px-2 py-1 text-xs rounded border border-slate-600 text-slate-300 hover:border-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveComment}
                      disabled={commentText.trim().length === 0}
                      className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

PaperCard.propTypes = {
  paper: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    authors: PropTypes.arrayOf(PropTypes.string).isRequired,
    finalScore: PropTypes.number,
    relevanceScore: PropTypes.number,
    scoreAdjustment: PropTypes.number,
    adjustmentReason: PropTypes.string,
    scoreJustification: PropTypes.string,
    deepAnalysis: PropTypes.shape({
      relevanceAssessment: PropTypes.string,
      summary: PropTypes.string,
    }),
  }).isRequired,
  idx: PropTypes.number.isRequired,
  showDeepAnalysis: PropTypes.bool.isRequired,
  starred: PropTypes.bool,
  dismissed: PropTypes.bool,
  briefingDate: PropTypes.string,
  onStar: PropTypes.func,
  onDismiss: PropTypes.func,
  onComment: PropTypes.func,
};

// Main Application Shell
export default function App() {
  const [config, setConfig] = useState(readInitialConfig);
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);

  // activeView: 'welcome' | 'profile' | 'settings' | 'pipeline' | 'briefing:<date>'
  const [activeView, setActiveView] = useState('welcome');

  // Briefing (Phase 1) state
  const {
    profile,
    updateProfile,
    saveSuggested,
    revertToRevision,
    clearHistory,
    migrationNotice,
    dismissMigrationNotice,
  } = useProfile({ scoringCriteria: config.scoringCriteria });
  const { current: currentBriefing, history: briefingHistory, saveBriefing } = useBriefing();
  const feedback = useFeedback();
  const newInteractionCount = feedback.getNewSince(profile?.lastFeedbackCutoff ?? 0).length;

  // Phase 1.5: draft-vs-committed profile editing.
  const [draftContent, setDraftContent] = useState(profile?.content ?? '');
  const [lastSyncedContent, setLastSyncedContent] = useState(profile?.content ?? '');
  if ((profile?.content ?? '') !== lastSyncedContent) {
    setDraftContent(profile?.content ?? '');
    setLastSyncedContent(profile?.content ?? '');
  }

  const abortControllerRef = useRef(null);
  const pauseRef = useRef(false);
  const mockAPITesterRef = useRef(null);

  // Read state from the Zustand store.
  const processing = useAnalyzerStore((s) => s.processing);
  const results = useAnalyzerStore((s) => s.results);
  const filterResults = useAnalyzerStore((s) => s.filterResults);
  const processingTiming = useAnalyzerStore((s) => s.processingTiming);
  const testState = useAnalyzerStore((s) => s.testState);
  const password = useAnalyzerStore((s) => s.password);
  const isAuthenticated = useAnalyzerStore((s) => s.isAuthenticated);

  const {
    podcastDuration,
    notebookLMModel,
    notebookLMStatus,
    notebookLMContent,
    notebookLMGenerating,
    enableHallucinationCheck,
    hallucinationWarning,
  } = useAnalyzerStore((s) => s.notebookLM);
  const {
    synthesizing,
    synthesisError,
    briefingCheckResult,
    briefingStage,
    quickSummariesById,
    fullReportsById,
  } = useAnalyzerStore((s) => s.briefingUI);

  // Actions — stable identity, no selector needed.
  const {
    setProcessing,
    setResults,
    setFilterResults,
    setProcessingTiming,
    setTestState,
    setPodcastDuration,
    setNotebookLMModel,
    setNotebookLMContent,
    setEnableHallucinationCheck,
    setSynthesizing,
    setSynthesisError,
    setBriefingCheckResult,
    setBriefingStage,
    setQuickSummariesById,
    setFullReportsById,
    setPassword,
    setIsAuthenticated,
    addError,
    setReactContext,
  } = useAnalyzerStore.getState();

  // Pipeline — reads state from the Zustand store. Only React refs are
  // passed as closure args.
  const pipeline = useMemo(
    () =>
      createAnalysisPipeline({
        abortControllerRef,
        pauseRef,
        mockAPITesterRef,
      }),
    []
  );

  // Publish React-hook values into the store's reactContext slice so
  // the pipeline can read them via store().reactContext.
  useEffect(() => {
    setReactContext({ profile, currentBriefing, feedback, config });
  }, [profile, currentBriefing, feedback, config, setReactContext]);

  useAnalyzerPersistence({
    config,
    results,
    filterResults,
    processingTiming,
    testState,
    podcastDuration,
    notebookLMModel,
    notebookLMContent,
    password,
    isAuthenticated,
    setResults,
    setFilterResults,
    setProcessingTiming,
    setTestState,
    setPodcastDuration,
    setNotebookLMModel,
    setNotebookLMContent,
    setPassword,
    setIsAuthenticated,
  });

  // Default activeView: if a current briefing exists, show it; else welcome.
  // Runs only on mount (and when currentBriefing identity changes from null
  // to populated, e.g. after localStorage hydration).
  const initialViewSet = useRef(false);
  useEffect(() => {
    if (initialViewSet.current) return;
    if (currentBriefing?.date) {
      setActiveView(`briefing:${currentBriefing.date}`);
      initialViewSet.current = true;
    }
  }, [currentBriefing]);

  const { startProcessing, runDryRunTest, runMinimalTest, generateNotebookLM } = pipeline;

  // --- Auth handlers ---
  const handleAuth = async () => {
    if (!password.trim()) {
      addError('Please enter a password');
      return;
    }

    try {
      const response = await fetch('/api/score-abstracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: [],
          scoringCriteria: '',
          password: password,
        }),
      });

      if (response.status === 401) {
        addError('Invalid password');
        return;
      }

      setIsAuthenticated(true);
    } catch {
      addError('Authentication failed');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    localStorage.removeItem('arxivAnalyzerState');
  };

  // --- Pipeline control handlers ---
  const handleStart = () => {
    startProcessing(false, false);
  };

  const handlePause = () => {
    pauseRef.current = true;
    setProcessing((prev) => ({ ...prev, isPaused: true }));
  };

  const handleResume = () => {
    pauseRef.current = false;
    setProcessing((prev) => ({ ...prev, isPaused: false }));
  };

  const handleStop = () => {
    console.log('Stop button clicked - aborting all operations');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('Abort signal sent');
    }

    pauseRef.current = false;

    setProcessing((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      stage: 'idle',
    }));

    setTestState((prev) => ({
      ...prev,
      dryRunInProgress: false,
      minimalTestInProgress: false,
    }));

    addError('Operation stopped by user');
  };

  const handleReset = () => {
    handleStop();
    setResults({ allPapers: [], scoredPapers: [], finalRanking: [] });
    setFilterResults({
      total: 0,
      yes: [],
      maybe: [],
      no: [],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
    });
    setProcessing({
      stage: 'idle',
      progress: { current: 0, total: 0 },
      errors: [],
      isRunning: false,
      isPaused: false,
    });
    setProcessingTiming({ startTime: null, endTime: null, duration: null });
    localStorage.removeItem('arxivAnalyzerState');
  };

  // --- Export handlers ---
  const exportResults = () => exportAnalysisReport({ results, processingTiming, config });

  const downloadNotebookLM = () => {
    if (!notebookLMContent) return;
    const timestamp = new Date().toISOString().split('T')[0];
    downloadBlob(
      notebookLMContent,
      `${timestamp}_notebooklm_${podcastDuration}min.md`,
      'text/markdown'
    );
  };

  // --- Filter verdict cycling ---
  const cycleFilterVerdict = useCallback(
    (paperId, currentVerdict) => {
      const VERDICT_CYCLE = { YES: 'MAYBE', MAYBE: 'NO', NO: 'YES' };
      const BUCKET_BY_VERDICT = { YES: 'yes', MAYBE: 'maybe', NO: 'no' };
      const nextVerdict = VERDICT_CYCLE[currentVerdict] ?? 'YES';
      setFilterResults((prev) => {
        const currentBucket = BUCKET_BY_VERDICT[currentVerdict];
        const nextBucket = BUCKET_BY_VERDICT[nextVerdict];
        if (!currentBucket || !nextBucket) return prev;
        const paper = prev[currentBucket].find((p) => p.id === paperId);
        if (!paper) return prev;
        const updatedPaper = { ...paper, filterVerdict: nextVerdict };
        return {
          ...prev,
          [currentBucket]: prev[currentBucket].filter((p) => p.id !== paperId),
          [nextBucket]: [...prev[nextBucket], updatedPaper],
        };
      });
    },
    [setFilterResults]
  );

  // --- Briefing generation ---
  const handleGenerateBriefing = () => {
    const resolvedBriefingModel = config?.briefingModel ?? config?.pdfModel ?? 'gemini-3.1-pro';
    const filterVerdictCounts = {
      yes: filterResults.yes?.length ?? 0,
      maybe: filterResults.maybe?.length ?? 0,
      no: filterResults.no?.length ?? 0,
    };
    const generationMetadata = {
      profileSnapshot: profile?.content ?? '',
      filterModel: config?.filterModel ?? '',
      scoringModel: config?.scoringModel ?? '',
      pdfModel: config?.pdfModel ?? '',
      briefingModel: resolvedBriefingModel,
      categories: [...(config?.selectedCategories ?? [])],
      filterVerdictCounts,
      feedbackCutoff: profile?.lastFeedbackCutoff ?? null,
      briefingRetryOnYes: config.briefingRetryOnYes ?? true,
      briefingRetryOnMaybe: config.briefingRetryOnMaybe ?? false,
      pauseAfterFilter: config.pauseAfterFilter ?? true,
      timestamp: new Date().toISOString(),
    };

    // Wrap saveBriefing so we can auto-switch to the new briefing view
    const saveBriefingAndSwitch = (date, briefing, metadata) => {
      saveBriefing(date, briefing, metadata);
      setActiveView(`briefing:${date}`);
    };

    return runBriefingGeneration({
      results,
      briefingModel: resolvedBriefingModel,
      pdfModel: config?.pdfModel,
      briefingRetryOnYes: config.briefingRetryOnYes ?? true,
      briefingRetryOnMaybe: config.briefingRetryOnMaybe ?? false,
      profile,
      password,
      briefingHistory,
      saveBriefing: saveBriefingAndSwitch,
      generationMetadata,
      setSynthesizing,
      setSynthesisError,
      setBriefingCheckResult,
      setBriefingStage,
      setQuickSummariesById,
      setFullReportsById,
    });
  };

  // --- Stage display helpers ---
  const getStageDisplay = () => {
    const stages = {
      idle: 'Ready',
      fetching: 'Fetching Categories',
      'initial-scoring': 'Scoring Abstracts',
      selecting: 'Selecting Top Papers',
      'deep-analysis': 'Analyzing PDFs',
      complete: 'Complete',
    };
    return stages[processing.stage] || processing.stage;
  };

  const getProgressPercentage = () => {
    if (processing.progress.total === 0) return 0;
    return Math.round((processing.progress.current / processing.progress.total) * 100);
  };

  // --- Stable callbacks for YourProfile ---
  const scrollToFeedback = useCallback(() => {
    const el = document.getElementById('feedback-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);
  const togglePreviewPanel = useCallback(() => setShowPreviewPanel((v) => !v), []);
  const openSuggestDialog = useCallback(() => setShowSuggestDialog(true), []);

  // --- Derived data (useMemo) ---
  const abstractOnlyPapers = useMemo(() => {
    const deepAnalyzedIds = new Set(results.finalRanking.map((p) => p.id));
    return results.scoredPapers.filter((p) => !deepAnalyzedIds.has(p.id));
  }, [results.finalRanking, results.scoredPapers]);

  const filterSortedPapers = useMemo(() => {
    const scoredPaperIds = new Set([
      ...results.scoredPapers.map((p) => p.id),
      ...(results.failedPapers ?? []).map((p) => p.id),
    ]);
    return {
      scoredPaperIds,
      unscoredYes: filterResults.yes.filter((p) => !scoredPaperIds.has(p.id)),
      unscoredMaybe: filterResults.maybe.filter((p) => !scoredPaperIds.has(p.id)),
      unscoredNo: filterResults.no.filter((p) => !scoredPaperIds.has(p.id)),
      scoredYesCount: filterResults.yes.filter((p) => scoredPaperIds.has(p.id)).length,
      scoredMaybeCount: filterResults.maybe.filter((p) => scoredPaperIds.has(p.id)).length,
    };
  }, [
    results.scoredPapers,
    results.failedPapers,
    filterResults.yes,
    filterResults.maybe,
    filterResults.no,
  ]);

  const feedbackIndex = useMemo(() => {
    const idx = new Map();
    for (const e of feedback.events) {
      if (!e.arxivId || (e.type !== 'star' && e.type !== 'dismiss')) continue;
      const entry = idx.get(e.arxivId) ?? { starred: false, dismissed: false };
      if (e.type === 'star') entry.starred = true;
      if (e.type === 'dismiss') entry.dismissed = true;
      idx.set(e.arxivId, entry);
    }
    return idx;
  }, [feedback.events]);

  const paperCardBriefingDate = currentBriefing?.date ?? new Date().toISOString().slice(0, 10);
  const renderPaperCard = (paper, idx, showDeepAnalysis) => {
    const entry = feedbackIndex.get(paper.id);
    return (
      <PaperCard
        key={paper.id}
        paper={paper}
        idx={idx}
        showDeepAnalysis={showDeepAnalysis}
        starred={entry?.starred ?? false}
        dismissed={entry?.dismissed ?? false}
        briefingDate={paperCardBriefingDate}
        onStar={feedback.addStar}
        onDismiss={feedback.addDismiss}
        onComment={feedback.addPaperComment}
      />
    );
  };

  // --- Auth gate ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex items-center justify-center p-6">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-8 border border-slate-800 max-w-md w-full">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 mx-auto mb-4 text-blue-400" />
            <h1 className="text-2xl font-bold mb-2">aparture</h1>
            <p className="text-gray-400">Enter password to access</p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                placeholder="Enter password"
              />
            </div>

            <button
              onClick={handleAuth}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              Access Analyzer
            </button>
          </div>

          {processing.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-red-300 text-sm">
                {processing.errors[processing.errors.length - 1]}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Authenticated shell ---
  return (
    <div className="shell">
      <Sidebar
        briefingHistory={briefingHistory}
        feedbackEvents={feedback.events}
        activeView={activeView}
        onSelectView={setActiveView}
        onNewBriefing={handleStart}
        feedbackCount={feedback.events.length}
      />

      <div className="shell-main">
        <MainArea
          activeView={activeView}
          // Briefing views
          briefingHistory={briefingHistory}
          currentBriefing={currentBriefing}
          quickSummariesById={quickSummariesById}
          fullReportsById={fullReportsById}
          results={results}
          feedbackEvents={feedback.events}
          onStar={feedback.addStar}
          onDismiss={feedback.addDismiss}
          onAddComment={(arxivId, text) => {
            // Look for the paper in the current briefing first, then in
            // the active briefing entry for the selected view.
            const dateKey = activeView.startsWith('briefing:')
              ? activeView.slice('briefing:'.length)
              : currentBriefing?.date;
            const entry = briefingHistory?.find((b) => b.date === dateKey);
            const paper = entry?.briefing?.papers?.find((p) => p.arxivId === arxivId);
            if (!paper) return;
            feedback.addPaperComment(
              {
                arxivId,
                paperTitle: paper.title,
                quickSummary: paper.quickSummary ?? '',
                score: paper.score,
                briefingDate: entry.date ?? new Date().toISOString().slice(0, 10),
              },
              text
            );
          }}
          // Profile view
          profile={profile}
          updateProfile={updateProfile}
          revertToRevision={revertToRevision}
          clearHistory={clearHistory}
          migrationNotice={migrationNotice}
          dismissMigrationNotice={dismissMigrationNotice}
          draftContent={draftContent}
          setDraftContent={setDraftContent}
          newInteractionCount={newInteractionCount}
          onScrollToFeedback={scrollToFeedback}
          onPreviewClick={togglePreviewPanel}
          onSuggestClick={openSuggestDialog}
          disabled={processing?.isRunning ?? false}
          showPreviewPanel={showPreviewPanel}
          previewPanelProps={{
            editedProfile: draftContent,
            models: {
              filter: config.filterModel,
              scoring: config.scoringModel,
              briefing: config.briefingModel ?? config.pdfModel ?? 'gemini-3.1-pro',
            },
            password,
            onClose: () => setShowPreviewPanel(false),
          }}
          // Settings view
          config={config}
          setConfig={setConfig}
          processing={processing}
          // Pipeline view
          testState={testState}
          processingTiming={processingTiming}
          filterResults={filterResults}
          filterSortedPapers={filterSortedPapers}
          abstractOnlyPapers={abstractOnlyPapers}
          renderPaperCard={renderPaperCard}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onReset={handleReset}
          onRunDryRun={runDryRunTest}
          onRunMinimalTest={runMinimalTest}
          onExport={exportResults}
          getStageDisplay={getStageDisplay}
          getProgressPercentage={getProgressPercentage}
          onCycleVerdict={cycleFilterVerdict}
          // Briefing card (generate button)
          synthesizing={synthesizing}
          synthesisError={synthesisError}
          briefingCheckResult={briefingCheckResult}
          briefingStage={briefingStage}
          onGenerateBriefing={handleGenerateBriefing}
          // Feedback panel
          feedbackCutoff={profile?.lastFeedbackCutoff ?? 0}
          onAddGeneralComment={(text) => {
            const today = new Date().toISOString().slice(0, 10);
            feedback.addGeneralComment(text, today);
          }}
          // NotebookLM
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
          onGenerateNotebookLM={generateNotebookLM}
          onDownloadNotebookLM={downloadNotebookLM}
          // Logout
          onLogout={handleLogout}
        />
      </div>

      {/* SuggestDialog — modal, always mounted at root */}
      <SuggestDialog
        isOpen={showSuggestDialog}
        onClose={() => setShowSuggestDialog(false)}
        profile={profile?.content ?? ''}
        newFeedback={feedback.getNewSince(profile?.lastFeedbackCutoff ?? 0)}
        cap={{ commentCap: 30 }}
        briefingModel={config.briefingModel ?? config.pdfModel ?? 'gemini-3.1-pro'}
        provider={(
          MODEL_REGISTRY[config.briefingModel ?? config.pdfModel]?.provider ?? 'Google'
        ).toLowerCase()}
        password={password}
        onAccept={(revisedProfile, rationale, newCutoff) => {
          saveSuggested(revisedProfile, newCutoff, rationale);
          setShowSuggestDialog(false);
        }}
      />
    </div>
  );
}
