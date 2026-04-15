import { Lock, Unlock } from 'lucide-react';
import PropTypes from 'prop-types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { MODEL_REGISTRY } from '../utils/models';
import { TEST_PAPERS } from '../utils/testUtils';
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
import { MockAPITester } from '../lib/analyzer/mockApi.js';
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

  // Enhanced robust API call with better abort checking
  const makeRobustAPICall = useCallback(
    async (apiCallFunction, parseFunction, context = '', originalPromptInfo = '') => {
      let lastError = null;

      for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
        try {
          // Check for abort before each retry
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Operation aborted');
          }
          if (pauseRef.current) {
            await waitForResume();
          }

          let responseText = await apiCallFunction();

          try {
            const result = parseFunction(responseText);
            return result;
          } catch (parseError) {
            lastError = parseError;
            addError(`${context} - Initial parse failed: ${parseError.message}`);
          }

          for (
            let correctionCount = 1;
            correctionCount <= config.maxCorrections;
            correctionCount++
          ) {
            try {
              // Check for abort before each correction
              if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
              }
              if (pauseRef.current) {
                await waitForResume();
              }

              addError(
                `${context} - Frontend correction attempt ${correctionCount}/${config.maxCorrections} (backend already attempted validation)`
              );

              const correctionPrompt = `The response still has issues after backend validation. Please provide a properly formatted response.

Previous response:
${responseText}

Error: ${lastError.message}

${originalPromptInfo ? `Original task: ${originalPromptInfo}` : ''}

Your entire response MUST ONLY be a single, valid JSON object/array. DO NOT respond with anything other than valid JSON.`;

              responseText = await apiCallFunction(correctionPrompt, true);

              const result = parseFunction(responseText);
              addError(`${context} - Correction ${correctionCount} succeeded`);
              return result;
            } catch (correctionError) {
              if (correctionError.message === 'Operation aborted') {
                throw correctionError;
              }
              lastError = correctionError;
              addError(
                `${context} - Correction ${correctionCount} failed: ${correctionError.message}`
              );
            }
          }

          if (retryCount < config.maxRetries) {
            addError(
              `${context} - All corrections failed, attempting full retry ${retryCount + 1}/${config.maxRetries}`
            );
          } else {
            throw new Error(
              `All retries and corrections exhausted. Last error: ${lastError?.message || 'Unknown error'}`
            );
          }
        } catch (apiError) {
          if (apiError.message === 'Operation aborted') {
            throw apiError;
          }
          lastError = apiError;
          if (retryCount < config.maxRetries) {
            addError(
              `${context} - API call failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`
            );

            // Sleep with abort checking
            const delay = 1000;
            for (let i = 0; i < delay; i += 50) {
              if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
              }
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } else {
            throw apiError;
          }
        }
      }

      throw lastError;
    },
    [config.maxRetries, config.maxCorrections, addError]
  );

  // Enhanced mock robust API call with better abort checking
  const makeMockRobustAPICall = useCallback(
    async (mockApiFunction, parseFunction, context = '') => {
      let lastError = null;

      for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
        try {
          // Check for abort before each retry
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Operation aborted');
          }
          if (pauseRef.current) {
            await waitForResume();
          }

          let responseText = await mockApiFunction();

          try {
            const result = parseFunction(responseText);
            return result;
          } catch (parseError) {
            lastError = parseError;
            addError(`${context} - Mock parse failed: ${parseError.message}`);
          }

          for (
            let correctionCount = 1;
            correctionCount <= config.maxCorrections;
            correctionCount++
          ) {
            try {
              // Check for abort before each correction
              if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
              }
              if (pauseRef.current) {
                await waitForResume();
              }

              addError(`${context} - Mock correction ${correctionCount}/${config.maxCorrections}`);
              responseText = await mockApiFunction(true); // Pass isCorrection = true
              const result = parseFunction(responseText);
              addError(`${context} - Mock correction ${correctionCount} succeeded`);
              return result;
            } catch (correctionError) {
              if (correctionError.message === 'Operation aborted') {
                throw correctionError;
              }
              lastError = correctionError;
              addError(
                `${context} - Mock correction ${correctionCount} failed: ${correctionError.message}`
              );
            }
          }

          if (retryCount < config.maxRetries) {
            addError(
              `${context} - Mock corrections failed, retry ${retryCount + 1}/${config.maxRetries}`
            );
          } else {
            throw new Error(
              `Mock retries exhausted. Last error: ${lastError?.message || 'Unknown error'}`
            );
          }
        } catch (apiError) {
          if (apiError.message === 'Operation aborted') {
            throw apiError;
          }
          lastError = apiError;
          if (retryCount < config.maxRetries) {
            addError(
              `${context} - Mock API failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`
            );

            // Sleep with abort checking
            const delay = 500;
            for (let i = 0; i < delay; i += 50) {
              if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
              }
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          } else {
            throw apiError;
          }
        }
      }

      throw lastError;
    },
    [config.maxRetries, config.maxCorrections, addError]
  );

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
  const fetchPapers = async () => {
    setProcessing((prev) => ({ ...prev, stage: 'fetching', progress: { current: 0, total: 0 } }));

    try {
      const categories = config.selectedCategories.filter((cat) => cat.trim());
      if (categories.length === 0) {
        throw new Error('No categories selected');
      }

      console.log(`Fetching papers for ${categories.length} categories: ${categories.join(', ')}`);

      // Set initial progress with total categories
      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: 0, total: categories.length },
      }));

      const allPapers = [];
      const requestDelay = 1000; // 1 second delay between requests

      // Process each category individually (like the Python version)
      for (let i = 0; i < categories.length; i++) {
        // Check for abort signal
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Operation aborted');
        }

        // Check for pause
        if (pauseRef.current) {
          await waitForResume();
        }

        const category = categories[i];

        try {
          console.log(`\nFetching category ${i + 1}/${categories.length}: ${category}`);

          // Add status message for category start
          addError(`Fetching ${category}...`);

          const categoryPapers = await fetchSingleCategory(category, addError);
          allPapers.push(...categoryPapers);

          console.log(`Found ${categoryPapers.length} papers for ${category}`);
          addError(`✓ ${category}: Found ${categoryPapers.length} papers`);

          // Update progress after each category
          setProcessing((prev) => ({
            ...prev,
            stage: 'fetching',
            progress: { current: i + 1, total: categories.length },
          }));
        } catch (error) {
          // Check if this is an abort error
          if (error.message === 'Operation aborted') {
            throw error;
          }

          console.error(`Error fetching category ${category}:`, error);
          addError(`Failed to fetch category ${category}: ${error.message}`);
          // Continue with other categories
        } finally {
          // Always delay between categories (except for the last one)
          if (i < categories.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, requestDelay));
          }
        }
      }

      // Remove duplicates based on paper ID
      const uniquePapers = removeDuplicatePapers(allPapers);

      // Sort by most recent submission date
      uniquePapers.sort((a, b) => new Date(b.published) - new Date(a.published));

      console.log(`\n=== FETCH SUMMARY ===`);
      console.log(`Total papers found: ${allPapers.length}`);
      console.log(`Unique papers: ${uniquePapers.length}`);
      console.log(`Duplicates removed: ${allPapers.length - uniquePapers.length}`);

      if (uniquePapers.length === 0) {
        addError(
          `No papers found for any category in the specified time range. Try increasing 'Days to Look Back' or check if categories are valid.`
        );
      }

      setResults((prev) => ({ ...prev, allPapers: uniquePapers }));

      // Final progress update
      setProcessing((prev) => ({
        ...prev,
        stage: 'fetching',
        progress: { current: categories.length, total: categories.length },
      }));

      return uniquePapers;
    } catch (error) {
      addError(`Failed to fetch papers: ${error.message}`);
      throw error;
    }
  };

  // Fetch papers for a single category with smart date range shifting
  const fetchSingleCategory = async (category, statusCallback) => {
    const maxResults = 300; // Maximum papers to fetch per category
    const maxDateShiftDays = 14; // Maximum days to shift back
    const minPapersThreshold = 5; // Only stop shifting if we find at least this many papers

    // Try to find a date range that contains papers
    for (let daysShifted = 0; daysShifted <= maxDateShiftDays; daysShifted++) {
      // Check for abort/pause before each attempt
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }
      if (pauseRef.current) {
        await waitForResume();
      }

      const { startDate, endDate } = calculateDateRange(daysShifted);
      const query = buildArxivQuery(category, startDate, endDate);

      console.log(
        `  Trying date range: ${startDate} to ${endDate}${daysShifted > 0 ? ` (shifted back ${daysShifted} days)` : ''}`
      );

      // Show date shift attempts in UI (only after first attempt)
      if (daysShifted > 0 && statusCallback) {
        statusCallback(`  ${category}: Trying -${daysShifted} days (${startDate}-${endDate})`);
      }

      try {
        const papers = await executeArxivQuery(query, maxResults, category);

        // Stop if we found enough papers
        if (papers.length >= minPapersThreshold) {
          if (daysShifted > 0) {
            console.log(
              `  ✓ Found ${papers.length} papers after shifting back ${daysShifted} days`
            );
            if (statusCallback) {
              statusCallback(
                `  ${category}: ✓ ${papers.length} papers (shifted back ${daysShifted} days)`
              );
            }
          }
          return papers;
        }
        // Last attempt - take whatever we have
        else if (papers.length > 0 && daysShifted === maxDateShiftDays) {
          console.log(
            `  ✓ Found ${papers.length} papers after ${daysShifted} days (below threshold of ${minPapersThreshold}, but final attempt)`
          );
          if (statusCallback) {
            statusCallback(
              `  ${category}: ✓ ${papers.length} papers (final attempt, below threshold)`
            );
          }
          return papers;
        }
        // First attempt with few papers - keep looking
        else if (papers.length > 0 && daysShifted === 0) {
          console.log(
            `  Found only ${papers.length} papers in original range (below threshold of ${minPapersThreshold}), trying shifted dates...`
          );
          if (statusCallback) {
            statusCallback(
              `  ${category}: Only ${papers.length} papers found, looking back further...`
            );
          }
        }
        // No papers at all on first attempt
        else if (papers.length === 0 && daysShifted === 0) {
          console.log(`  No papers found in original date range, trying with shifted dates...`);
          if (statusCallback) {
            statusCallback(`  ${category}: No papers in recent range, looking back...`);
          }
        }

        // Add delay before next attempt (if not the last attempt)
        if (daysShifted < maxDateShiftDays) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        }
      } catch (error) {
        // Check if this is an abort error
        if (error.message === 'Operation aborted') {
          throw error;
        }

        console.error(
          `  Error with query for ${category} (day shift ${daysShifted}):`,
          error.message
        );
        // Don't fail fast - continue trying with date shifts
        // Network errors might be transient

        // Add delay before retry even on error
        if (daysShifted < maxDateShiftDays) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        }
      }
    }

    console.log(
      `  Warning: No papers found for ${category} even after shifting back ${maxDateShiftDays} days`
    );
    return [];
  };

  // Calculate date range for arXiv query
  const calculateDateRange = (daysShifted = 0) => {
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() - daysShifted);

    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - config.daysBack);

    // Format as YYYYMMDD for arXiv API
    const formatDate = (date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    };

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  };

  // Build arXiv query string (following Python implementation pattern)
  const buildArxivQuery = (category, startDate, endDate) => {
    // Use submittedDate with wildcards like the Python version
    const dateQuery = `submittedDate:[${startDate} TO ${endDate}]`;
    const categoryQuery = `cat:${category}`;

    // Combine with proper parentheses like Python version
    return `(${categoryQuery}) AND ${dateQuery}`;
  };

  // Execute the actual arXiv API query
  const executeArxivQuery = async (query, maxResults, category) => {
    // Check for abort before making request
    if (abortControllerRef.current?.signal.aborted) {
      throw new Error('Operation aborted');
    }

    console.log(`  Query: ${query}`);

    // Use server-side proxy to avoid CORS issues
    const response = await fetch('/api/fetch-arxiv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, maxResults, password }),
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `arXiv API HTTP error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.xml;
    console.log(`  Response length: ${text.length} chars`);

    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    // Check for parsing errors
    const parseErrors = xml.getElementsByTagName('parsererror');
    if (parseErrors.length > 0) {
      throw new Error('XML parsing error in arXiv response');
    }

    // Check for arXiv API errors
    const errorElements = xml.getElementsByTagName('error');
    if (errorElements.length > 0) {
      const errorText = errorElements[0].textContent;
      throw new Error(`arXiv API error: ${errorText}`);
    }

    const entries = xml.getElementsByTagName('entry');
    const papers = [];

    for (const entry of entries) {
      // Check for abort during parsing
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }

      try {
        const paper = parseArxivEntry(entry, category);
        if (paper && paper.id) {
          papers.push(paper);
        }
      } catch (error) {
        console.warn(`Error parsing entry:`, error);
        // Continue with other entries
      }
    }

    return papers;
  };

  // Parse a single arXiv entry from the XML
  const parseArxivEntry = (entry, fetchedCategory) => {
    const getId = (entry) => {
      const id = entry.getElementsByTagName('id')[0]?.textContent;
      let extractedId = id ? id.split('/abs/')[1] : '';
      // Strip any trailing .pdf or version numbers (e.g., v1, v2)
      extractedId = extractedId.replace(/\.pdf$/, '').replace(/v\d+$/, '');
      return extractedId;
    };

    const getAuthors = (entry) => {
      const authors = entry.getElementsByTagName('author');
      return Array.from(authors)
        .map((a) => a.getElementsByTagName('name')[0]?.textContent || '')
        .filter((name) => name.length > 0);
    };

    const getCategories = (entry) => {
      const categories = entry.getElementsByTagName('category');
      return Array.from(categories)
        .map((c) => c.getAttribute('term'))
        .filter((term) => term && term.length > 0);
    };

    const cleanText = (text) => {
      return text ? text.replace(/\s+/g, ' ').trim() : '';
    };

    return {
      id: getId(entry),
      title: cleanText(entry.getElementsByTagName('title')[0]?.textContent || ''),
      abstract: cleanText(entry.getElementsByTagName('summary')[0]?.textContent || ''),
      authors: getAuthors(entry),
      published: entry.getElementsByTagName('published')[0]?.textContent || '',
      updated: entry.getElementsByTagName('updated')[0]?.textContent || '',
      categories: getCategories(entry),
      pdfUrl: `https://export.arxiv.org/pdf/${getId(entry)}.pdf`,
      fetchedCategory: fetchedCategory,
    };
  };

  // Remove duplicate papers based on arXiv ID
  const removeDuplicatePapers = (papers) => {
    const seen = new Set();
    return papers.filter((paper) => {
      if (seen.has(paper.id)) {
        return false;
      }
      seen.add(paper.id);
      return true;
    });
  };

  // Quick filter papers using YES/NO/MAYBE verdicts
  const performQuickFilter = async (papers, isDryRun = false) => {
    if (!config.useQuickFilter) {
      return papers; // Skip filtering if disabled
    }

    setProcessing((prev) => ({
      ...prev,
      stage: 'Filtering',
      progress: { current: 0, total: papers.length },
    }));

    const batchSize = config.filterBatchSize || 10;
    const totalBatches = Math.ceil(papers.length / batchSize);

    // Initialize filter results
    setFilterResults({
      total: papers.length,
      yes: [],
      maybe: [],
      no: [],
      inProgress: true,
      currentBatch: 0,
      totalBatches,
    });

    const filteredPapers = [];
    const allVerdicts = [];

    for (let i = 0; i < papers.length; i += batchSize) {
      if (pauseRef.current) {
        await waitForResume();
      }

      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Operation aborted');
      }

      const batch = papers.slice(i, Math.min(i + batchSize, papers.length));
      const batchIndex = Math.floor(i / batchSize);

      setFilterResults((prev) => ({ ...prev, currentBatch: batchIndex + 1 }));

      try {
        let verdicts;

        if (isDryRun) {
          // Mock filter for dry run using the mock API tester
          const mockApiCall = async (isCorrection = false) => {
            if (!mockAPITesterRef.current) {
              mockAPITesterRef.current = new MockAPITester({
                abortControllerRef,
                pauseRef,
                waitForResume,
              });
            }
            return await mockAPITesterRef.current.mockQuickFilter(batch, isCorrection);
          };

          const parseResponse = (text) => {
            const cleaned = text
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const parsed = JSON.parse(cleaned);
            // Ensure we return an array format
            return Array.isArray(parsed) ? parsed : parsed.verdicts || [];
          };

          verdicts = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock filter batch ${batchIndex + 1}/${totalBatches}`
          );
        } else {
          // Real API call
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              papers: batch.map((p) => ({ title: p.title, id: p.id, abstract: p.abstract })),
              scoringCriteria: profile.content,
              password: password,
              model: config.filterModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/quick-filter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Filter API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            if (data.error) {
              throw new Error(data.error);
            }

            return data.rawResponse || JSON.stringify(data.verdicts);
          };

          const parseResponse = (text) => {
            const cleaned = text
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const parsed = JSON.parse(cleaned);
            if (!parsed.verdicts && Array.isArray(parsed)) {
              return { verdicts: parsed };
            }
            return parsed;
          };

          const result = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Filter batch ${batchIndex + 1}/${totalBatches}`
          );

          verdicts = result.verdicts || result;
        }

        // Apply verdicts to papers
        // Handle both array format (real API) and paperIndex format (mock API)
        const verdictsArray = Array.isArray(verdicts) ? verdicts : [];

        verdictsArray.forEach((verdict) => {
          // Get the paper based on paperIndex (1-indexed) or by order
          const paperIdx = verdict.paperIndex
            ? verdict.paperIndex - 1
            : verdictsArray.indexOf(verdict);

          if (paperIdx >= 0 && paperIdx < batch.length) {
            const paper = batch[paperIdx];
            paper.filterVerdict = verdict.verdict;
            // Phase 1.5.1: capture the original verdict + the model's summary
            // and justification so the UI can show them and track user overrides.
            paper.originalVerdict = verdict.verdict;
            paper.filterSummary = verdict.summary ?? '';
            paper.filterJustification = verdict.justification ?? '';

            // Update live results
            if (verdict.verdict === 'YES') {
              setFilterResults((prev) => ({ ...prev, yes: [...prev.yes, paper] }));
            } else if (verdict.verdict === 'MAYBE') {
              setFilterResults((prev) => ({ ...prev, maybe: [...prev.maybe, paper] }));
            } else {
              setFilterResults((prev) => ({ ...prev, no: [...prev.no, paper] }));
            }

            // Add to filtered list if in selected categories
            if (config.categoriesToScore.includes(verdict.verdict)) {
              filteredPapers.push(paper);
            }
          }
        });

        allVerdicts.push(...verdictsArray);

        setProcessing((prev) => ({
          ...prev,
          progress: { current: Math.min(i + batchSize, papers.length), total: papers.length },
        }));
      } catch (error) {
        if (error.message === 'Operation aborted') {
          throw error;
        }
        addError(`Filter batch ${batchIndex + 1} failed: ${error.message}`);
        // On failure, include all papers in batch as MAYBE (safe default)
        batch.forEach((paper) => {
          paper.filterVerdict = 'MAYBE';
          if (config.categoriesToScore.includes('MAYBE')) {
            filteredPapers.push(paper);
          }
        });
      }
    }

    setFilterResults((prev) => ({ ...prev, inProgress: false }));

    console.log(`\n=== FILTER SUMMARY ===`);
    console.log(`Total papers: ${papers.length}`);
    console.log(
      `YES: ${filterResults.yes.length} (${Math.round((filterResults.yes.length / papers.length) * 100)}%)`
    );
    console.log(
      `MAYBE: ${filterResults.maybe.length} (${Math.round((filterResults.maybe.length / papers.length) * 100)}%)`
    );
    console.log(
      `NO: ${filterResults.no.length} (${Math.round((filterResults.no.length / papers.length) * 100)}%)`
    );
    console.log(`Papers proceeding to scoring: ${filteredPapers.length}`);

    return filteredPapers;
  };

  // Score abstracts using chosen API (or mock for dry run)
  const scoreAbstracts = async (papers, isDryRun = false) => {
    // Phase 1.5.1 B3: record filter-override events for any papers whose
    // verdict was changed by the user before scoring started. Compare the
    // current filterResults buckets against each paper's originalVerdict
    // (captured at filter time). One filter-override event per changed
    // paper.
    try {
      const allBuckets = [
        { bucket: 'YES', papers: filterResults.yes },
        { bucket: 'MAYBE', papers: filterResults.maybe },
        { bucket: 'NO', papers: filterResults.no },
      ];
      const today = new Date().toISOString().slice(0, 10);
      for (const { bucket: currentVerdict, papers: bucketPapers } of allBuckets) {
        for (const paper of bucketPapers) {
          if (paper.originalVerdict && paper.originalVerdict !== currentVerdict) {
            feedback.addFilterOverride({
              arxivId: paper.arxivId ?? paper.id,
              paperTitle: paper.title,
              summary: paper.filterSummary ?? '',
              justification: paper.filterJustification ?? '',
              originalVerdict: paper.originalVerdict,
              newVerdict: currentVerdict,
              briefingDate: today,
            });
          }
        }
      }
    } catch (overrideErr) {
      console.warn('[Phase 1.5.1] Failed to record filter overrides:', overrideErr);
    }

    setProcessing((prev) => ({
      ...prev,
      stage: 'initial-scoring',
      progress: { current: 0, total: papers.length },
    }));

    const scoredPapers = [];
    const failedPapers = []; // Track failed papers separately
    const batchSize = config.scoringBatchSize || config.batchSize || 3; // Use scoringBatchSize, fallback to old batchSize

    for (let i = 0; i < papers.length; i += batchSize) {
      if (pauseRef.current) {
        await waitForResume();
      }

      const batch = papers.slice(i, Math.min(i + batchSize, papers.length));

      try {
        let scores;

        if (isDryRun) {
          // Use mock API for dry run
          const mockApiCall = async (isCorrection = false) => {
            return await mockAPITesterRef.current.mockScoreAbstracts(batch, isCorrection);
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const scores = JSON.parse(cleanedText);

            if (!Array.isArray(scores)) {
              throw new Error('Response is not an array');
            }

            scores.forEach((score, idx) => {
              if (
                !score.hasOwnProperty('paperIndex') ||
                !score.hasOwnProperty('score') ||
                !score.hasOwnProperty('justification')
              ) {
                throw new Error(`Score object ${idx} missing required fields`);
              }
              if (
                typeof score.paperIndex !== 'number' ||
                typeof score.score !== 'number' ||
                typeof score.justification !== 'string'
              ) {
                throw new Error(`Score object ${idx} has invalid field types`);
              }
              // Validate score range (allow 0-10 inclusive)
              if (score.score < 0 || score.score > 10) {
                throw new Error(
                  `Score object ${idx} score must be between 0.0 and 10.0, got ${score.score}`
                );
              }
              // Round to one decimal place to handle floating point precision issues
              score.score = Math.round(score.score * 10) / 10;
            });

            return scores;
          };

          scores = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock scoring batch ${Math.floor(i / batchSize) + 1}`
          );
        } else {
          // Use real API for production
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              papers: batch,
              scoringCriteria: profile.content,
              password: password,
              model: config.scoringModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/score-abstracts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `API error: ${response.status}`);
            }

            const data = await response.json();
            // If scores are already parsed, return them directly; otherwise return rawResponse for parsing
            if (data.scores && Array.isArray(data.scores)) {
              return JSON.stringify(data.scores);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const scores = JSON.parse(cleanedText);

            if (!Array.isArray(scores)) {
              throw new Error('Response is not an array');
            }

            scores.forEach((score, idx) => {
              if (
                !score.hasOwnProperty('paperIndex') ||
                !score.hasOwnProperty('score') ||
                !score.hasOwnProperty('justification')
              ) {
                throw new Error(`Score object ${idx} missing required fields`);
              }
              if (
                typeof score.paperIndex !== 'number' ||
                typeof score.score !== 'number' ||
                typeof score.justification !== 'string'
              ) {
                throw new Error(`Score object ${idx} has invalid field types`);
              }
              // Validate score range - allow decimals
              if (score.score < 0 || score.score > 10) {
                throw new Error(
                  `Score object ${idx} score must be between 0.0 and 10.0, got ${score.score}`
                );
              }
              // Round to one decimal place to handle floating point precision issues
              score.score = Math.round(score.score * 10) / 10;
            });

            return scores;
          };

          scores = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Scoring batch ${Math.floor(i / batchSize) + 1}`,
            `Score ${batch.length} paper abstracts for relevance using the provided criteria`
          );
        }

        // Process successful scores
        scores.forEach((scoreData) => {
          const paperIdx = scoreData.paperIndex - 1;
          if (paperIdx >= 0 && paperIdx < batch.length) {
            const scoredPaper = {
              ...batch[paperIdx],
              relevanceScore: scoreData.score,
              scoreJustification: scoreData.justification,
              // Store initial scores for post-processing
              initialScore: scoreData.score,
              initialJustification: scoreData.justification,
            };

            // Only add papers with valid scores (> 0) to the main results
            if (scoreData.score > 0) {
              scoredPapers.push(scoredPaper);
            } else {
              // Track papers with score 0 separately
              failedPapers.push({
                ...scoredPaper,
                failureReason: 'Scored as 0 relevance',
              });
            }
          }
        });
      } catch (error) {
        // Check if this is an abort error
        if (error.message === 'Operation aborted') {
          throw error;
        }

        addError(
          `Failed to score batch starting at paper ${i + 1} after all retries: ${error.message}`
        );

        // Add failed papers to the failed list, not the main results
        batch.forEach((p) => {
          failedPapers.push({
            ...p,
            relevanceScore: 0,
            scoreJustification: 'Failed to score after retries',
            failureReason: error.message,
          });
        });
      }

      // Update progress AND results after each batch
      setProcessing((prev) => ({
        ...prev,
        progress: { current: Math.min(i + batchSize, papers.length), total: papers.length },
      }));

      // Update results with current scored papers (sorted by score, only successful ones)
      const currentSorted = [...scoredPapers].sort((a, b) => b.relevanceScore - a.relevanceScore);
      setResults((prev) => ({
        ...prev,
        scoredPapers: currentSorted,
        failedPapers: failedPapers, // Store failed papers separately
      }));

      await new Promise((resolve) => setTimeout(resolve, isDryRun ? 100 : 1500));
    }

    // Log summary of results
    console.log(`\n=== SCORING SUMMARY ===`);
    console.log(`Successfully scored papers: ${scoredPapers.length}`);
    console.log(`Failed papers: ${failedPapers.length}`);
    if (failedPapers.length > 0) {
      addError(
        `Warning: ${failedPapers.length} papers failed to score and will be excluded from deep analysis`
      );
    }

    const finalSorted = [...scoredPapers].sort((a, b) => b.relevanceScore - a.relevanceScore);
    return finalSorted;
  };

  // Post-process scores for consistency and accuracy
  const postProcessScores = async (papers, isDryRun = false) => {
    // Skip if disabled or no papers to process
    if (!config.enableScorePostProcessing || papers.length === 0) {
      return papers;
    }

    setProcessing((prev) => ({
      ...prev,
      stage: 'Post-Processing',
      progress: { current: 0, total: Math.min(config.postProcessingCount, papers.length) },
    }));

    // Select papers for post-processing (simply take the top N papers)
    const selectedPapers = papers.slice(0, config.postProcessingCount);

    if (selectedPapers.length === 0) {
      console.log('No papers to post-process');
      return papers;
    }

    // Randomize the selected papers to prevent bias in batch comparisons
    // Fisher-Yates shuffle to ensure uniform distribution
    const papersToProcess = [...selectedPapers];
    for (let i = papersToProcess.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [papersToProcess[i], papersToProcess[j]] = [papersToProcess[j], papersToProcess[i]];
    }

    console.log(`\n=== POST-PROCESSING ${papersToProcess.length} PAPERS ===`);
    console.log(`Papers shuffled for unbiased batch comparisons`);

    const processedPapers = [];
    const batchSize = config.postProcessingBatchSize || 5;

    for (let i = 0; i < papersToProcess.length; i += batchSize) {
      if (pauseRef.current) {
        await waitForResume();
      }

      const batch = papersToProcess.slice(i, Math.min(i + batchSize, papersToProcess.length));

      try {
        let rescores;

        if (isDryRun) {
          // Use mock API for dry run
          const mockApiCall = async (isCorrection = false) => {
            return await mockAPITesterRef.current.mockRescoreAbstracts(batch, isCorrection);
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const rescores = JSON.parse(cleanedText);

            if (!Array.isArray(rescores)) {
              throw new Error('Response is not an array');
            }

            rescores.forEach((rescore, idx) => {
              if (
                !rescore.hasOwnProperty('paperIndex') ||
                !rescore.hasOwnProperty('adjustedScore') ||
                !rescore.hasOwnProperty('adjustmentReason') ||
                !rescore.hasOwnProperty('confidence')
              ) {
                throw new Error(`Rescore object ${idx} missing required fields`);
              }
              if (
                typeof rescore.paperIndex !== 'number' ||
                typeof rescore.adjustedScore !== 'number' ||
                typeof rescore.adjustmentReason !== 'string' ||
                typeof rescore.confidence !== 'string'
              ) {
                throw new Error(`Rescore object ${idx} has invalid field types`);
              }
              if (rescore.adjustedScore < 0 || rescore.adjustedScore > 10) {
                throw new Error(`Rescore object ${idx} adjustedScore must be between 0.0 and 10.0`);
              }
              if (!['HIGH', 'MEDIUM', 'LOW'].includes(rescore.confidence)) {
                throw new Error(`Rescore object ${idx} confidence must be HIGH, MEDIUM, or LOW`);
              }
              // Round to one decimal place
              rescore.adjustedScore = Math.round(rescore.adjustedScore * 10) / 10;
            });

            return rescores;
          };

          rescores = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock rescoring batch ${Math.floor(i / batchSize) + 1}`
          );
        } else {
          // Use real API for production
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              papers: batch.map((p) => ({
                title: p.title,
                abstract: p.abstract,
                initialScore: p.initialScore,
                initialJustification: p.initialJustification,
              })),
              scoringCriteria: profile.content,
              password: password,
              model: config.postProcessingModel || config.scoringModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/rescore-abstracts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.rescores && Array.isArray(data.rescores)) {
              return JSON.stringify(data.rescores);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const rescores = JSON.parse(cleanedText);

            if (!Array.isArray(rescores)) {
              throw new Error('Response is not an array');
            }

            // Validate each rescore
            rescores.forEach((rescore) => {
              if (rescore.adjustedScore < 0 || rescore.adjustedScore > 10) {
                throw new Error(`Adjusted score must be between 0.0 and 10.0`);
              }
              // Round to one decimal place
              rescore.adjustedScore = Math.round(rescore.adjustedScore * 10) / 10;
            });

            return rescores;
          };

          rescores = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Rescoring batch ${Math.floor(i / batchSize) + 1}`,
            `Rescore ${batch.length} paper abstracts for consistency`
          );
        }

        // Apply rescores to papers
        rescores.forEach((rescoreData) => {
          const paperIdx = rescoreData.paperIndex - 1;
          if (paperIdx >= 0 && paperIdx < batch.length) {
            const processedPaper = {
              ...batch[paperIdx],
              relevanceScore: rescoreData.adjustedScore, // Update current score
              adjustedScore: rescoreData.adjustedScore, // Store adjusted score
              adjustmentReason: rescoreData.adjustmentReason,
              adjustmentConfidence: rescoreData.confidence,
              scoreAdjustment: rescoreData.adjustedScore - batch[paperIdx].initialScore,
            };
            processedPapers.push(processedPaper);
          }
        });
      } catch (error) {
        // Check if this is an abort error
        if (error.message === 'Operation aborted') {
          throw error;
        }

        addError(`Failed to rescore batch starting at paper ${i + 1}: ${error.message}`);

        // Keep original scores for failed batch
        batch.forEach((p) => {
          processedPapers.push(p);
        });
      }

      // Update progress
      setProcessing((prev) => ({
        ...prev,
        progress: {
          current: Math.min(i + batchSize, papersToProcess.length),
          total: papersToProcess.length,
        },
      }));
    }

    // Merge processed papers back with unprocessed ones
    const processedIds = new Set(processedPapers.map((p) => p.id));
    const unchangedPapers = papers.filter((p) => !processedIds.has(p.id));
    const allPapers = [...processedPapers, ...unchangedPapers];

    console.log(`\n=== POST-PROCESSING SUMMARY ===`);
    console.log(`Papers post-processed: ${processedPapers.length}`);
    const adjustedCount = processedPapers.filter(
      (p) => p.scoreAdjustment && Math.abs(p.scoreAdjustment) > 0.1
    ).length;
    console.log(`Papers with adjusted scores: ${adjustedCount}`);

    // Re-sort by updated scores
    return allPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);
  };

  // Deep analysis of PDFs (or mock for dry run)
  const analyzePDFs = async (papers, isDryRun = false) => {
    setProcessing((prev) => ({
      ...prev,
      stage: 'deep-analysis',
      progress: { current: 0, total: papers.length },
    }));

    const analyzedPapers = [];

    for (let i = 0; i < papers.length; i++) {
      if (pauseRef.current) {
        await waitForResume();
      }

      const paper = papers[i];

      try {
        let analysis;

        if (isDryRun) {
          // Use mock API for dry run
          const mockApiCall = async (isCorrection = false) => {
            return await mockAPITesterRef.current.mockAnalyzePDF(paper, isCorrection);
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const analysis = JSON.parse(cleanedText);

            if (!analysis.summary || typeof analysis.updatedScore === 'undefined') {
              throw new Error(
                'Missing required fields (summary or updatedScore) in analysis response'
              );
            }

            if (typeof analysis.summary !== 'string') {
              throw new Error('Summary field must be a string');
            }
            if (typeof analysis.updatedScore !== 'number') {
              throw new Error('UpdatedScore field must be a number');
            }
            // Validate score range (allow 0-10 inclusive)
            if (analysis.updatedScore < 0 || analysis.updatedScore > 10) {
              throw new Error(
                `UpdatedScore must be between 0.0 and 10.0, got ${analysis.updatedScore}`
              );
            }
            // Round to one decimal place to handle floating point precision issues
            analysis.updatedScore = Math.round(analysis.updatedScore * 10) / 10;

            return analysis;
          };

          analysis = await makeMockRobustAPICall(
            mockApiCall,
            parseResponse,
            `Mock analyzing paper "${paper.title}"`
          );
        } else {
          // Use real API for production
          const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
            const requestBody = {
              pdfUrl: paper.pdfUrl,
              scoringCriteria: profile.content,
              originalScore: paper.relevanceScore,
              originalJustification: paper.scoreJustification,
              password: password,
              model: config.pdfModel,
            };

            if (isCorrection && correctionPrompt) {
              requestBody.correctionPrompt = correctionPrompt;
            }

            const response = await fetch('/api/analyze-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `API error: ${response.status}`);
            }

            const data = await response.json();
            // If analysis is already parsed, return it directly; otherwise return rawResponse for parsing
            if (data.analysis && typeof data.analysis === 'object') {
              return JSON.stringify(data.analysis);
            }
            return data.rawResponse;
          };

          const parseResponse = (responseText) => {
            const cleanedText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();
            const analysis = JSON.parse(cleanedText);

            if (!analysis.summary || typeof analysis.updatedScore === 'undefined') {
              throw new Error(
                'Missing required fields (summary or updatedScore) in analysis response'
              );
            }

            if (typeof analysis.summary !== 'string') {
              throw new Error('Summary field must be a string');
            }
            if (typeof analysis.updatedScore !== 'number') {
              throw new Error('UpdatedScore field must be a number');
            }
            // Validate score range - allow decimals
            if (analysis.updatedScore < 0 || analysis.updatedScore > 10) {
              throw new Error(
                `UpdatedScore must be between 0.0 and 10.0, got ${analysis.updatedScore}`
              );
            }
            // Round to one decimal place to handle floating point precision issues
            analysis.updatedScore = Math.round(analysis.updatedScore * 10) / 10;

            return analysis;
          };

          analysis = await makeRobustAPICall(
            makeAPICall,
            parseResponse,
            `Analyzing paper "${paper.title}"`,
            `Analyze PDF content and provide updated relevance score with detailed summary`
          );
        }

        analyzedPapers.push({
          ...paper,
          deepAnalysis: analysis,
          finalScore: analysis.updatedScore,
        });

        setProcessing((prev) => ({
          ...prev,
          progress: { current: i + 1, total: papers.length },
        }));

        // Update finalRanking by replacing the analyzed paper in the existing list
        setResults((prev) => {
          const updatedRanking = [...prev.finalRanking];
          const paperIndex = updatedRanking.findIndex((p) => p.id === paper.id);
          if (paperIndex !== -1) {
            updatedRanking[paperIndex] = {
              ...paper,
              deepAnalysis: analysis,
              finalScore: analysis.updatedScore,
            };
          }
          // Always re-sort the entire array by the highest available score
          updatedRanking.sort((a, b) => {
            const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
            const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
            return scoreB - scoreA;
          });

          return { ...prev, finalRanking: updatedRanking };
        });

        await new Promise((resolve) => setTimeout(resolve, isDryRun ? 100 : 2000));
      } catch (error) {
        addError(`Failed to analyze paper "${paper.title}" after all retries: ${error.message}`);
        analyzedPapers.push({
          ...paper,
          deepAnalysis: null,
          finalScore: paper.relevanceScore || 0,
        });
      }
    }

    return analyzedPapers;
  };

  // Wait for resume when paused
  const waitForResume = () => {
    return new Promise((resolve) => {
      const checkPause = setInterval(() => {
        if (!pauseRef.current) {
          clearInterval(checkPause);
          resolve();
        }
      }, 100);
    });
  };

  // Main processing pipeline
  const startProcessing = async (isDryRun = false, useTestPapers = false) => {
    const startTime = new Date();
    setProcessingTiming({ startTime, endTime: null, duration: null });
    setProcessing((prev) => ({ ...prev, isRunning: true, isPaused: false, errors: [] }));

    // Reset filter results for new processing
    setFilterResults({
      total: 0,
      yes: [],
      maybe: [],
      no: [],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
    });

    pauseRef.current = false;
    abortControllerRef.current = new AbortController();

    let finalPapers = []; // Track final papers locally

    try {
      let papers;

      if (useTestPapers) {
        // Use hardcoded test papers for minimal test
        setProcessing((prev) => ({ ...prev, stage: 'fetching' }));
        papers = TEST_PAPERS;
        setResults((prev) => ({ ...prev, allPapers: papers }));
      } else {
        // Stage 1: Fetch papers from arXiv
        papers = await fetchPapers();
        if (papers.length === 0) {
          addError('No papers found for specified categories');
          return;
        }
      }

      // Stage 2: Quick filter (if enabled)
      let papersToScore = papers;
      if (config.useQuickFilter) {
        papersToScore = await performQuickFilter(papers, isDryRun);

        if (papersToScore.length === 0) {
          addError(
            'No papers passed the initial filter. Consider adjusting filter criteria or categories.'
          );
          return;
        }

        console.log(`\n=== FILTER COMPLETE ===`);
        console.log(
          `Papers proceeding to scoring: ${papersToScore.length} of ${papers.length} (${Math.round((papersToScore.length / papers.length) * 100)}%)`
        );
      }

      // Stage 3: Score abstracts (now returns only successfully scored papers)
      const scoredPapers = await scoreAbstracts(papersToScore, isDryRun);

      if (scoredPapers.length === 0) {
        addError(
          'No papers could be scored successfully. Check your API configuration and try again.'
        );
        return;
      }

      // Stage 3.5: Post-process scores for consistency (optional)
      let postProcessedPapers = scoredPapers;
      if (config.enableScorePostProcessing) {
        postProcessedPapers = await postProcessScores(scoredPapers, isDryRun);
      }

      // Stage 4: Select top papers for deep analysis (now working with filtered, sorted, and optionally post-processed papers)
      setProcessing((prev) => ({ ...prev, stage: 'selecting' }));

      // Use the sorted postProcessedPapers from results, and ensure minimum score threshold
      // Use the local postProcessedPapers variable (not results.scoredPapers which may not be updated yet)
      const availablePapers = postProcessedPapers.filter(
        (paper) =>
          paper.relevanceScore > 0 && paper.scoreJustification !== 'Failed to score after retries'
      );

      const topPapers = availablePapers.slice(0, config.maxDeepAnalysis);

      console.log(`\n=== SELECTION SUMMARY ===`);
      console.log(`Available papers for deep analysis: ${availablePapers.length}`);
      console.log(`Selected for deep analysis: ${topPapers.length}`);

      if (topPapers.length === 0) {
        addError(
          'No papers qualified for deep analysis. All papers either failed to score or had zero relevance.'
        );
        return;
      }

      // Pre-populate finalRanking to prevent empty state during PDF analysis
      setResults((prev) => ({ ...prev, finalRanking: topPapers }));

      // Stage 5: Deep analysis
      const analyzedPapers = await analyzePDFs(topPapers, isDryRun);

      // Stage 6: Final ranking and output
      setProcessing((prev) => ({ ...prev, stage: 'complete' }));

      // Sort by final score (or relevance score as fallback)
      analyzedPapers.sort((a, b) => {
        const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
        const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
        return scoreB - scoreA;
      });

      finalPapers = analyzedPapers.slice(0, config.finalOutputCount);

      setResults((prev) => ({ ...prev, finalRanking: finalPapers }));
    } catch (error) {
      if (error.name !== 'AbortError' && error.message !== 'Operation aborted') {
        addError(`Processing failed: ${error.message}`);
      }
    } finally {
      const endTime = new Date();
      const duration = startTime ? endTime - startTime : 0;
      setProcessingTiming((prev) => ({
        ...prev,
        startTime: prev.startTime || startTime,
        endTime,
        duration,
      }));

      setProcessing((prev) => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        // Use local finalPapers array instead of results.finalRanking
        stage: finalPapers.length > 0 ? 'complete' : 'idle',
      }));
    }
  };

  // Enhanced test functions with proper abort controller setup
  const runDryRunTest = async () => {
    setTestState((prev) => ({ ...prev, dryRunInProgress: true }));

    try {
      // Create new abort controller for this test
      const oldAbortController = abortControllerRef.current;
      abortControllerRef.current = new AbortController();

      // Reset mock API tester to enhanced version
      mockAPITesterRef.current = new MockAPITester({ abortControllerRef, pauseRef, waitForResume });
      addError('Starting dry run test - no API costs incurred');

      await startProcessing(true, false); // isDryRun = true, useTestPapers = false

      setTestState((prev) => ({
        ...prev,
        dryRunCompleted: true,
        lastDryRunTime: new Date(),
        dryRunInProgress: false,
      }));

      addError('Dry run test completed successfully — click Download Report to save.');

      // Restore previous abort controller
      abortControllerRef.current = oldAbortController;
    } catch (error) {
      if (error.message === 'Operation aborted') {
        addError('Dry run test was cancelled');
      } else {
        addError(`Dry run test failed: ${error.message}`);
      }
      setTestState((prev) => ({ ...prev, dryRunInProgress: false }));
    }
  };

  const runMinimalTest = async () => {
    setTestState((prev) => ({ ...prev, minimalTestInProgress: true }));

    try {
      // Create new abort controller for this test
      const oldAbortController = abortControllerRef.current;
      abortControllerRef.current = new AbortController();

      addError('Starting minimal test with real API calls');

      await startProcessing(false, true); // isDryRun = false, useTestPapers = true

      setTestState((prev) => ({
        ...prev,
        lastMinimalTestTime: new Date(),
        minimalTestInProgress: false,
      }));

      addError('Minimal test completed successfully — click Download Report to save.');

      // Restore previous abort controller
      abortControllerRef.current = oldAbortController;
    } catch (error) {
      if (error.message === 'Operation aborted') {
        addError('Minimal test was cancelled');
      } else {
        addError(`Minimal test failed: ${error.message}`);
      }
      setTestState((prev) => ({ ...prev, minimalTestInProgress: false }));
    }
  };

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
  const generateNotebookLM = async () => {
    try {
      setNotebookLMGenerating(true);
      setNotebookLMStatus('Generating NotebookLM document...');
      setNotebookLMContent(null);
      setHallucinationWarning(null); // Reset previous warning

      // Combine scored papers and final ranking
      const allPapers =
        results.finalRanking && results.finalRanking.length > 0
          ? results.finalRanking
          : results.scoredPapers.filter((p) => p.score > 0 || p.relevanceScore > 0);

      if (allPapers.length === 0) {
        setNotebookLMStatus('No papers available for NotebookLM generation');
        setNotebookLMGenerating(false);
        return;
      }

      let markdown;

      // Use mock API if in test mode
      if (testState.dryRunInProgress && mockAPITesterRef.current) {
        console.log('Using mock NotebookLM generation API...');
        markdown = await mockAPITesterRef.current.mockGenerateNotebookLM(
          allPapers,
          podcastDuration,
          notebookLMModel
        );
      } else {
        const response = await fetch('/api/generate-notebooklm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            papers: allPapers.map((paper) => ({
              ...paper,
              pdfAnalysis: paper.pdfAnalysis || null,
            })),
            scoringCriteria: profile.content,
            targetDuration: podcastDuration,
            model: notebookLMModel,
            password,
            enableHallucinationCheck,
            briefing: currentBriefing?.briefing ?? null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate NotebookLM document');
        }

        markdown = data.markdown;

        // Handle hallucination warning
        if (data.metadata?.hallucinationDetected) {
          const issueCount = data.metadata.hallucinationIssues?.length || 0;
          const fictionalPapers =
            data.metadata.hallucinationIssues?.filter((i) => i.includes('HALLUCINATED PAPER'))
              .length || 0;

          setHallucinationWarning({
            detected: true,
            issues: data.metadata.hallucinationIssues || [],
            summary: `Found ${fictionalPapers} fictional papers and ${issueCount - fictionalPapers} other issues`,
            resolved: data.metadata.strictModeSuccessful !== false,
          });

          addError(
            `Hallucination detected: ${issueCount} issues found - automatically corrected with strict mode`
          );
          if (data.metadata.strictModeSuccessful !== false) {
            addError('✓ Strict mode successfully prevented hallucinations');
          }
        } else if (data.metadata?.warnings?.length > 0) {
          console.log('Minor warnings:', data.metadata.warnings);
        } else {
          setHallucinationWarning(null);
        }
      }

      setNotebookLMContent(markdown);
      setNotebookLMStatus('NotebookLM document generated successfully');
    } catch (error) {
      console.error('NotebookLM generation error:', error);
      setNotebookLMStatus(`Error: ${error.message}`);
    } finally {
      setNotebookLMGenerating(false);
    }
  };

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

  const handleGenerateBriefing = () =>
    runBriefingGeneration({
      results,
      config,
      profile,
      password,
      briefingHistory,
      saveBriefing,
      setSynthesizing,
      setSynthesisError,
      setBriefingCheckResult,
      setBriefingStage,
      setQuickSummariesById,
      setFullReportsById,
    });

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
