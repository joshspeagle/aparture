import { Lock, Unlock } from 'lucide-react';
import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_REGISTRY } from '../utils/models';
import BriefingCard from './briefing/BriefingCard.jsx';
import BriefingView from './briefing/BriefingView.jsx';
import ControlPanel from './analyzer/ControlPanel.jsx';
import ProgressTracker from './analyzer/ProgressTracker.jsx';
import AnalysisResultsList from './results/AnalysisResultsList.jsx';
import DownloadReportCard from './results/DownloadReportCard.jsx';
import FeedbackPanel from './feedback/FeedbackPanel.jsx';
import FilterResultsList from './filter/FilterResultsList.jsx';
import NotebookLMCard from './notebooklm/NotebookLMCard.jsx';
import YourProfile from './profile/YourProfile.jsx';
import SuggestDialog from './profile/SuggestDialog.jsx';
import PreviewPanel from './profile/PreviewPanel.jsx';
import SettingsPanel from './settings/SettingsPanel.jsx';
import { runBriefingGeneration } from '../lib/analyzer/briefingClient.js';
import { downloadBlob, exportAnalysisReport } from '../lib/analyzer/exportReport.js';
import { createAnalysisPipeline } from '../lib/analyzer/pipeline.js';
import { readInitialConfig, useAnalyzerPersistence } from '../hooks/useAnalyzerPersistence.js';
import { useProfile } from '../hooks/useProfile.js';
import { useBriefing } from '../hooks/useBriefing.js';
import { useFeedback } from '../hooks/useFeedback.js';

// Phase 1.5.1 D5 fix: PaperCard hoisted to module scope so React can reconcile
// cards across re-renders rather than unmount/remount them (which would destroy
// the inline comment textarea state during active scoring / progress ticks).
// All closure-captured data (feedback state, callbacks, briefing date) is now
// passed explicitly as props. The parent computes starred/dismissed once via
// useMemo from a feedback-event index.
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
                {paper.scoreAdjustment > 0 ? '↑' : '↓'} {Math.abs(paper.scoreAdjustment).toFixed(1)}
              </span>
            )}
            {showDeepAnalysis && paper.deepAnalysis && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                📄 PDF Analyzed
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
                  {starred ? '★ starred' : '☆ star'}
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
                  {dismissed ? '⊘ dismissed' : '⊘ dismiss'}
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
                    placeholder="Your thoughts on this paper…"
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

// Main Application Component
function ArxivAnalyzer() {
  const [config, setConfig] = useState(readInitialConfig);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [processing, setProcessing] = useState({
    stage: 'idle',
    progress: { current: 0, total: 0 },
    errors: [],
    isRunning: false,
    isPaused: false,
  });
  const [results, setResults] = useState({
    allPapers: [],
    scoredPapers: [],
    finalRanking: [],
  });
  const [filterResults, setFilterResults] = useState({
    total: 0,
    yes: [],
    maybe: [],
    no: [],
    inProgress: false,
    currentBatch: 0,
    totalBatches: 0,
  });
  const [processingTiming, setProcessingTiming] = useState({
    startTime: null,
    endTime: null,
    duration: null,
  });
  const [testState, setTestState] = useState({
    dryRunCompleted: false,
    dryRunInProgress: false,
    minimalTestInProgress: false,
    lastDryRunTime: null,
    lastMinimalTestTime: null,
  });

  // NotebookLM states
  const [podcastDuration, setPodcastDuration] = useState(20); // Default to 20 minutes
  const [notebookLMModel, setNotebookLMModel] = useState('gemini-3.1-pro');
  const [notebookLMStatus, setNotebookLMStatus] = useState('');
  const [notebookLMContent, setNotebookLMContent] = useState(null);
  const [notebookLMGenerating, setNotebookLMGenerating] = useState(false);
  const [enableHallucinationCheck, setEnableHallucinationCheck] = useState(true);
  const [hallucinationWarning, setHallucinationWarning] = useState(null);

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

  // Phase 1.5: draft-vs-committed profile editing. Typing in the Your Profile
  // textarea updates draftContent only; Save commits it via updateProfile.
  // When profile.content changes from an external source (revert, suggest
  // accept), we resync draftContent via a signature check during render.
  const [draftContent, setDraftContent] = useState(profile?.content ?? '');
  const [lastSyncedContent, setLastSyncedContent] = useState(profile?.content ?? '');
  if ((profile?.content ?? '') !== lastSyncedContent) {
    setDraftContent(profile?.content ?? '');
    setLastSyncedContent(profile?.content ?? '');
  }
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState(null);
  // Phase 1.5.1: hallucination check result + retry stage indicator
  const [briefingCheckResult, setBriefingCheckResult] = useState(null);
  const [briefingStage, setBriefingStage] = useState(null); // 'synthesizing' | 'checking' | 'retrying' | null
  const [quickSummariesById, setQuickSummariesById] = useState({});
  const [fullReportsById, setFullReportsById] = useState({});

  const abortControllerRef = useRef(null);
  const pauseRef = useRef(false);
  const mockAPITesterRef = useRef(null);

  // Phase 1.5.1 F4: the analysis pipeline lives in lib/analyzer/pipeline.js
  // as a builder that closes over a single mutable stateRef. We update
  // stateRef.current on every render so the pipeline always reads current
  // state at call time — no stale closure capture.
  const pipelineStateRef = useRef(null);
  // Factory only stores the ref; .current is read lazily inside stage
  // closures when they are called later, never during render.
  // eslint-disable-next-line react-hooks/refs
  const pipeline = useMemo(() => createAnalysisPipeline(pipelineStateRef), []);

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

  // Add error to log
  const addError = useCallback((error) => {
    setProcessing((prev) => ({
      ...prev,
      errors: [...prev.errors, `[${new Date().toLocaleTimeString()}] ${error}`],
    }));
  }, []);

  // Phase 1.5.1 F4: publish current state/setters/refs to the pipeline's
  // mutable state ref after every render. Deps list the reactive VALUES the
  // pipeline reads; state setters are omitted because React guarantees
  // their identity is stable across renders (adding them would re-fire the
  // effect on every render for zero benefit). Refs are omitted for the same
  // reason — they are stable objects whose .current is mutated in place.
  useEffect(() => {
    pipelineStateRef.current = {
      config,
      results,
      filterResults,
      testState,
      profile,
      password,
      currentBriefing,
      podcastDuration,
      notebookLMModel,
      notebookLMContent,
      enableHallucinationCheck,
      hallucinationWarning,
      setResults,
      setProcessing,
      setFilterResults,
      setProcessingTiming,
      setTestState,
      setNotebookLMContent,
      setNotebookLMStatus,
      setNotebookLMGenerating,
      setHallucinationWarning,
      abortControllerRef,
      pauseRef,
      mockAPITesterRef,
      addError,
      feedback,
    };
  }, [
    config,
    results,
    filterResults,
    testState,
    profile,
    password,
    currentBriefing,
    podcastDuration,
    notebookLMModel,
    notebookLMContent,
    enableHallucinationCheck,
    hallucinationWarning,
    addError,
    feedback,
  ]);

  const { startProcessing, runDryRunTest, runMinimalTest, generateNotebookLM } = pipeline;

  // Handle authentication
  const handleAuth = async () => {
    if (!password.trim()) {
      addError('Please enter a password');
      return;
    }

    try {
      const response = await fetch('/api/score-abstracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Fetch papers from arXiv

  // Fetch papers for a single category with smart date range shifting

  // Calculate date range for arXiv query

  // Build arXiv query string (following Python implementation pattern)

  // Execute the actual arXiv API query

  // Parse a single arXiv entry from the XML

  // Remove duplicate papers based on arXiv ID

  // Quick filter papers using YES/NO/MAYBE verdicts

  // Score abstracts using chosen API (or mock for dry run)

  // Post-process scores for consistency and accuracy

  // Deep analysis of PDFs (or mock for dry run)

  // Wait for resume when paused

  // Main processing pipeline

  // Enhanced test functions with proper abort controller setup

  // Control functions
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

  // Enhanced handleStop function
  const handleStop = () => {
    console.log('Stop button clicked - aborting all operations');

    // Abort current operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('Abort signal sent');
    }

    // Reset pause state
    pauseRef.current = false;

    // Update UI state immediately
    setProcessing((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      stage: 'idle',
    }));

    // Reset test states
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

  // Export results in a standardized format
  const exportResults = () => exportAnalysisReport({ results, processingTiming, config });

  // Generate NotebookLM document

  const downloadNotebookLM = () => {
    if (!notebookLMContent) return;
    const timestamp = new Date().toISOString().split('T')[0];
    downloadBlob(
      notebookLMContent,
      `${timestamp}_notebooklm_${podcastDuration}min.md`,
      'text/markdown'
    );
  };

  // Generate Briefing (Phase 1)
  // Phase 1.5.1 B3: click-cycle verdict override. Moves a paper between
  // filterResults buckets (yes/maybe/no) when the user clicks its verdict pill.
  // The paper's originalVerdict is preserved (captured at filter time) so that
  // when scoring runs we can diff current vs. original and record filter-override
  // feedback events for any changed papers.
  const cycleFilterVerdict = useCallback((paperId, currentVerdict) => {
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
  }, []);

  const handleGenerateBriefing = () => {
    // Phase B-prep: construct the generationMetadata snapshot at call
    // time so the eventual briefing entry carries full provenance.
    // The metadata is intentionally captured by value (snapshot of
    // the current state) — subsequent edits to profile / settings do
    // NOT retroactively change past briefings' recorded provenance.
    //
    // Resolve the effective briefingModel once so the metadata
    // records exactly what the pipeline will use. Falls back to
    // pdfModel for legacy configs that predate briefingModel, then
    // to the standard default if neither is set.
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
    return runBriefingGeneration({
      results,
      briefingModel: resolvedBriefingModel,
      pdfModel: config?.pdfModel,
      briefingRetryOnYes: config.briefingRetryOnYes ?? true,
      briefingRetryOnMaybe: config.briefingRetryOnMaybe ?? false,
      profile,
      password,
      briefingHistory,
      saveBriefing,
      generationMetadata,
      setSynthesizing,
      setSynthesisError,
      setBriefingCheckResult,
      setBriefingStage,
      setQuickSummariesById,
      setFullReportsById,
    });
  };

  // Get stage display name
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

  // Get stage progress percentage
  const getProgressPercentage = () => {
    if (processing.progress.total === 0) return 0;
    return Math.round((processing.progress.current / processing.progress.total) * 100);
  };

  // Phase 1.5.1 D5: stable callbacks for YourProfile so it can memo
  // meaningfully in the future without re-rendering on every parent tick.
  const scrollToFeedback = useCallback(() => {
    const el = document.getElementById('feedback-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);
  const togglePreviewPanel = useCallback(() => setShowPreviewPanel((v) => !v), []);
  const openSuggestDialog = useCallback(() => setShowSuggestDialog(true), []);

  // Phase 1.5.1 D5: derive abstract-only papers once per render cycle
  // instead of inside an IIFE in the JSX block.
  const abstractOnlyPapers = useMemo(() => {
    const deepAnalyzedIds = new Set(results.finalRanking.map((p) => p.id));
    return results.scoredPapers.filter((p) => !deepAnalyzedIds.has(p.id));
  }, [results.finalRanking, results.scoredPapers]);

  // Phase 1.5.1 D5: derive filter-bucket scoring state once. Used by the
  // filter-results panel to show which papers have already been scored and
  // which are still pending (unscored).
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

  // Phase 1.5.1 D5: index feedback events by arxivId once per render so
  // PaperCard lookups are O(1) instead of O(events) per card.
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

  // If not authenticated, show login screen
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              aparture
            </h1>
            <p className="text-gray-400">Bringing the arXiv into focus</p>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-slate-700 rounded-lg font-medium hover:bg-slate-600 transition-colors flex items-center gap-2 text-sm"
          >
            <Unlock className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Your Profile Panel (Phase 1.5) */}
        <YourProfile
          profile={profile}
          updateProfile={updateProfile}
          migrationNotice={migrationNotice}
          dismissMigrationNotice={dismissMigrationNotice}
          revertToRevision={revertToRevision}
          clearHistory={clearHistory}
          newInteractionCount={newInteractionCount}
          draftContent={draftContent}
          setDraftContent={setDraftContent}
          onScrollToFeedback={scrollToFeedback}
          onPreviewClick={togglePreviewPanel}
          onSuggestClick={openSuggestDialog}
          disabled={processing?.isRunning ?? false}
        />

        {showPreviewPanel && (
          <div className="mt-4">
            <PreviewPanel
              editedProfile={draftContent}
              models={{
                filter: config.filterModel,
                scoring: config.scoringModel,
                briefing: config.briefingModel ?? config.pdfModel ?? 'gemini-3.1-pro',
              }}
              password={password}
              onClose={() => setShowPreviewPanel(false)}
            />
          </div>
        )}

        <SettingsPanel config={config} setConfig={setConfig} processing={processing} />

        <ControlPanel
          processing={processing}
          testState={testState}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onReset={handleReset}
          onRunDryRun={runDryRunTest}
          onRunMinimalTest={runMinimalTest}
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
          onExport={exportResults}
        />

        <BriefingCard
          results={results}
          testState={testState}
          synthesizing={synthesizing}
          synthesisError={synthesisError}
          briefingCheckResult={briefingCheckResult}
          briefingStage={briefingStage}
          processing={processing}
          onGenerate={handleGenerateBriefing}
        />

        {currentBriefing && (
          <div className="mb-6">
            <BriefingView
              briefing={currentBriefing.briefing}
              date={new Date(currentBriefing.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              briefingDate={currentBriefing.date ?? new Date().toISOString().slice(0, 10)}
              papersScreened={results?.allPapers?.length ?? 0}
              quickSummariesById={quickSummariesById}
              fullReportsById={fullReportsById}
              feedbackEvents={feedback.events}
              onStar={feedback.addStar}
              onDismiss={feedback.addDismiss}
              onAddComment={(arxivId, text) => {
                const paper = currentBriefing.briefing.papers.find((p) => p.arxivId === arxivId);
                if (!paper) return;
                feedback.addPaperComment(
                  {
                    arxivId,
                    paperTitle: paper.title,
                    quickSummary: paper.quickSummary ?? '',
                    score: paper.score,
                    briefingDate: currentBriefing.date ?? new Date().toISOString().slice(0, 10),
                  },
                  text
                );
              }}
              onSkipQuestion={() => console.log('skip question')}
              onPreviewProfileUpdate={(answer) =>
                console.log('Phase 2 will show a diff. Phase 1 captures the answer:', answer)
              }
            />
          </div>
        )}

        {currentBriefing && (
          <div id="feedback-panel" className="mb-6">
            <FeedbackPanel
              events={feedback.events}
              cutoff={profile?.lastFeedbackCutoff ?? 0}
              onAddGeneralComment={(text) => {
                const today = new Date().toISOString().slice(0, 10);
                feedback.addGeneralComment(text, today);
              }}
              onSuggestClick={openSuggestDialog}
            />
          </div>
        )}

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
          onGenerate={generateNotebookLM}
          onDownload={downloadNotebookLM}
        />

        <FilterResultsList
          filterResults={filterResults}
          filterSortedPapers={filterSortedPapers}
          testState={testState}
          processing={processing}
          onCycleVerdict={cycleFilterVerdict}
        />

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
    </div>
  );
}

export default ArxivAnalyzer;
