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

  const badgeBase = {
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-xs)',
    padding: '2px 8px',
    borderRadius: '4px',
    display: 'inline-block',
  };

  const feedbackBtnBase = {
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-xs)',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid var(--aparture-hairline)',
    background: 'transparent',
    color: 'var(--aparture-mute)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  return (
    <div
      style={{
        background: 'var(--aparture-surface)',
        borderRadius: '4px',
        padding: 'var(--aparture-space-4)',
        border: '1px solid var(--aparture-hairline)',
        transition: 'border-color 150ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ flex: 1 }}>
          {/* Top row: rank + final score + arXiv link */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ ...badgeBase, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
              #{idx + 1}
            </span>
            <span style={{ ...badgeBase, background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
              {(paper.finalScore || paper.relevanceScore).toFixed(1)}/10
            </span>
            <a
              href={`https://arxiv.org/abs/${paper.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...badgeBase,
                background: 'var(--aparture-bg)',
                color: 'var(--aparture-mute)',
                textDecoration: 'none',
                marginLeft: 'auto',
              }}
            >
              arXiv:{paper.id}
            </a>
          </div>
          {/* Score trail: abstract → rescore → PDF */}
          {(paper.scoreAdjustment || paper.deepAnalysis) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
                flexWrap: 'wrap',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: '11px',
                color: 'var(--aparture-mute)',
              }}
            >
              {/* Abstract score */}
              <span
                style={{
                  ...badgeBase,
                  background: 'var(--aparture-bg)',
                  color: 'var(--aparture-mute)',
                  fontSize: '11px',
                }}
              >
                Abstract: {(paper.initialScore ?? paper.relevanceScore ?? 0).toFixed(1)}
              </span>
              {/* Rescore */}
              {paper.scoreAdjustment != null && Math.abs(paper.scoreAdjustment) > 0.01 && (
                <>
                  <span style={{ color: 'var(--aparture-mute)' }}>{'\u2192'}</span>
                  <span
                    style={{
                      ...badgeBase,
                      fontSize: '11px',
                      background:
                        paper.scoreAdjustment > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
                      color: paper.scoreAdjustment > 0 ? '#22c55e' : '#f97316',
                    }}
                  >
                    Rescore: {(paper.adjustedScore ?? paper.relevanceScore ?? 0).toFixed(1)}
                    {' ('}
                    {paper.scoreAdjustment > 0 ? '\u2191' : '\u2193'}
                    {Math.abs(paper.scoreAdjustment).toFixed(1)}
                    {')'}
                  </span>
                </>
              )}
              {/* PDF score */}
              {paper.finalScore != null && paper.deepAnalysis && (
                <>
                  <span style={{ color: 'var(--aparture-mute)' }}>{'\u2192'}</span>
                  <span
                    style={{
                      ...badgeBase,
                      fontSize: '11px',
                      background:
                        paper.pdfScoreAdjustment > 0
                          ? 'rgba(34,197,94,0.1)'
                          : paper.pdfScoreAdjustment < 0
                            ? 'rgba(249,115,22,0.1)'
                            : 'var(--aparture-bg)',
                      color:
                        paper.pdfScoreAdjustment > 0
                          ? '#22c55e'
                          : paper.pdfScoreAdjustment < 0
                            ? '#f97316'
                            : 'var(--aparture-mute)',
                    }}
                  >
                    PDF: {paper.finalScore.toFixed(1)}
                    {paper.pdfScoreAdjustment != null &&
                      Math.abs(paper.pdfScoreAdjustment) > 0.01 && (
                        <>
                          {' ('}
                          {paper.pdfScoreAdjustment > 0 ? '\u2191' : '\u2193'}
                          {Math.abs(paper.pdfScoreAdjustment).toFixed(1)}
                          {')'}
                        </>
                      )}
                  </span>
                </>
              )}
            </div>
          )}
          {/* Adjustment reasons (visible, not hidden in tooltips) */}
          {paper.adjustmentReason && (
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: '11px',
                color: 'var(--aparture-mute)',
                marginBottom: '4px',
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontWeight: 500 }}>Rescore:</span> {paper.adjustmentReason}
            </p>
          )}
          <h3
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-lg)',
              fontWeight: 600,
              color: 'var(--aparture-ink)',
              marginBottom: '4px',
            }}
          >
            {paper.title}
          </h3>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-mute)',
              marginBottom: '8px',
            }}
          >
            {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
          </p>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-ink)',
              fontStyle: 'italic',
              marginBottom: '8px',
            }}
          >
            {paper.deepAnalysis?.relevanceAssessment || paper.scoreJustification}
          </p>
          {showDeepAnalysis && paper.deepAnalysis && (
            <div
              style={{
                marginTop: 'var(--aparture-space-3)',
                paddingTop: 'var(--aparture-space-3)',
                borderTop: '1px solid var(--aparture-hairline)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-sm)',
                  color: 'var(--aparture-ink)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}
              >
                {paper.deepAnalysis.summary}
              </div>
            </div>
          )}

          {hasFeedbackAffordance && (
            <div
              style={{
                marginTop: 'var(--aparture-space-3)',
                paddingTop: 'var(--aparture-space-3)',
                borderTop: '1px solid var(--aparture-hairline)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleStar}
                  style={{
                    ...feedbackBtnBase,
                    ...(starred
                      ? {
                          background: 'rgba(245,158,11,0.15)',
                          color: '#f59e0b',
                          borderColor: '#f59e0b',
                        }
                      : {}),
                  }}
                  title={starred ? 'Remove star' : 'Star this paper'}
                >
                  {starred ? '\u2605 starred' : '\u2606 star'}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  style={{
                    ...feedbackBtnBase,
                    ...(dismissed
                      ? {
                          background: 'var(--aparture-bg)',
                          color: 'var(--aparture-ink)',
                          borderColor: 'var(--aparture-mute)',
                        }
                      : {}),
                  }}
                  title={dismissed ? 'Remove dismiss' : 'Dismiss this paper'}
                >
                  {dismissed ? '\u2298 dismissed' : '\u2298 dismiss'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCommentInput((v) => !v)}
                  style={feedbackBtnBase}
                  title="Leave a comment on this paper"
                >
                  + comment
                </button>
              </div>
              {showCommentInput && (
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                    placeholder="Your thoughts on this paper\u2026"
                    style={{
                      width: '100%',
                      minHeight: '4rem',
                      resize: 'vertical',
                      borderRadius: '4px',
                      border: '1px solid var(--aparture-hairline)',
                      background: 'var(--aparture-bg)',
                      padding: '4px 8px',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: 'var(--aparture-ink)',
                      boxSizing: 'border-box',
                    }}
                    autoFocus
                  />
                  <div
                    style={{
                      marginTop: '4px',
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleCancelComment}
                      style={{
                        ...feedbackBtnBase,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveComment}
                      disabled={commentText.trim().length === 0}
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--aparture-accent)',
                        background: 'var(--aparture-accent)',
                        color: '#fff',
                        fontWeight: 500,
                        cursor: commentText.trim().length === 0 ? 'not-allowed' : 'pointer',
                        opacity: commentText.trim().length === 0 ? 0.5 : 1,
                      }}
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
  const {
    current: currentBriefing,
    history: briefingHistory,
    saveBriefing,
    deleteBriefing,
    toggleArchive,
  } = useBriefing();
  const feedback = useFeedback();

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
    if (currentBriefing?.id) {
      setActiveView(`briefing:${currentBriefing.id}`);
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
      const newId = saveBriefing(date, briefing, metadata);
      setActiveView(`briefing:${newId}`);
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
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--aparture-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--aparture-space-6)',
        }}
      >
        <div
          style={{
            background: 'var(--aparture-surface)',
            border: '1px solid var(--aparture-hairline)',
            borderRadius: '4px',
            padding: 'var(--aparture-space-8)',
            maxWidth: '400px',
            width: '100%',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 'var(--aparture-space-6)' }}>
            <Lock
              className="w-12 h-12"
              style={{
                margin: '0 auto var(--aparture-space-4)',
                display: 'block',
                color: 'var(--aparture-accent)',
              }}
            />
            <h1
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-2xl)',
                fontWeight: 700,
                color: 'var(--aparture-ink)',
                marginBottom: '8px',
              }}
            >
              aparture
            </h1>
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                color: 'var(--aparture-mute)',
              }}
            >
              Enter password to access
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--aparture-bg)',
                  border: '1px solid var(--aparture-hairline)',
                  borderRadius: '4px',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-sm)',
                  color: 'var(--aparture-ink)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={handleAuth}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--aparture-accent)',
                color: '#fff',
                border: '1px solid var(--aparture-accent)',
                borderRadius: '4px',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              Access Analyzer
            </button>
          </div>

          {processing.errors.length > 0 && (
            <div
              style={{
                marginTop: 'var(--aparture-space-4)',
                padding: 'var(--aparture-space-3)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '4px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-sm)',
                  color: '#ef4444',
                }}
              >
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
        onDeleteBriefing={deleteBriefing}
        onToggleArchive={toggleArchive}
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
            const entryKey = activeView.startsWith('briefing:')
              ? activeView.slice('briefing:'.length)
              : currentBriefing?.id;
            const entry = briefingHistory?.find((b) => b.id === entryKey);
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
          newFeedback={feedback.getNewSince(profile?.lastFeedbackCutoff ?? 0)}
          onSuggestClick={openSuggestDialog}
          disabled={processing?.isRunning ?? false}
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
          onContinueAfterFilter={() => {
            pauseRef.current = false;
          }}
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
