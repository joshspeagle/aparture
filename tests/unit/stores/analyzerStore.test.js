import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalyzerStore } from '../../../stores/analyzerStore.js';

beforeEach(() => {
  // Reset the store to pristine data values between tests via the
  // explicit resetStore action. Using setState(initialState()) directly
  // would be fragile — future top-level keys absent from initialState()
  // would leak between tests.
  useAnalyzerStore.getState().resetStore();
});

describe('analyzerStore — processing slice', () => {
  it('starts with idle processing state', () => {
    const s = useAnalyzerStore.getState();
    expect(s.processing.stage).toBe('idle');
    expect(s.processing.isRunning).toBe(false);
    expect(s.processing.isPaused).toBe(false);
    expect(s.processing.errors).toEqual([]);
    expect(s.processing.progress).toEqual({ current: 0, total: 0 });
  });

  it('setProcessing accepts a partial patch', () => {
    useAnalyzerStore.getState().setProcessing({ stage: 'fetching', isRunning: true });
    const s = useAnalyzerStore.getState();
    expect(s.processing.stage).toBe('fetching');
    expect(s.processing.isRunning).toBe(true);
    // Other fields preserved
    expect(s.processing.isPaused).toBe(false);
  });

  it('setProcessing accepts a functional updater', () => {
    useAnalyzerStore.getState().setProcessing((prev) => ({ ...prev, stage: 'filtering' }));
    expect(useAnalyzerStore.getState().processing.stage).toBe('filtering');
  });

  it('addError appends to processing.errors', () => {
    useAnalyzerStore.getState().addError('boom');
    const s = useAnalyzerStore.getState();
    expect(s.processing.errors).toHaveLength(1);
    expect(s.processing.errors[0]).toContain('boom');
  });
});

describe('analyzerStore — results slice', () => {
  it('starts empty', () => {
    const { results } = useAnalyzerStore.getState();
    expect(results.allPapers).toEqual([]);
    expect(results.scoredPapers).toEqual([]);
    expect(results.finalRanking).toEqual([]);
  });

  it('setResults accepts a patch', () => {
    useAnalyzerStore.getState().setResults({ allPapers: [{ id: '1' }] });
    expect(useAnalyzerStore.getState().results.allPapers).toHaveLength(1);
  });

  it('setResults accepts a functional updater', () => {
    useAnalyzerStore.getState().setResults((prev) => ({ ...prev, scoredPapers: [{ id: '2' }] }));
    expect(useAnalyzerStore.getState().results.scoredPapers).toHaveLength(1);
  });
});

describe('analyzerStore — filterResults slice', () => {
  it('starts empty', () => {
    const { filterResults } = useAnalyzerStore.getState();
    expect(filterResults.total).toBe(0);
    expect(filterResults.yes).toEqual([]);
    expect(filterResults.maybe).toEqual([]);
    expect(filterResults.no).toEqual([]);
    expect(filterResults.inProgress).toBe(false);
  });

  it('setFilterResults accepts a patch', () => {
    useAnalyzerStore.getState().setFilterResults({
      yes: [{ id: '1' }, { id: '2' }],
      inProgress: true,
    });
    const s = useAnalyzerStore.getState();
    expect(s.filterResults.yes).toHaveLength(2);
    expect(s.filterResults.inProgress).toBe(true);
    expect(s.filterResults.maybe).toEqual([]);
  });
});

describe('analyzerStore — testState slice', () => {
  it('starts with all flags false and timestamps null', () => {
    const { testState } = useAnalyzerStore.getState();
    expect(testState.dryRunCompleted).toBe(false);
    expect(testState.dryRunInProgress).toBe(false);
    expect(testState.minimalTestInProgress).toBe(false);
    expect(testState.lastDryRunTime).toBeNull();
    expect(testState.lastMinimalTestTime).toBeNull();
  });

  it('setTestState accepts a patch', () => {
    useAnalyzerStore.getState().setTestState({ dryRunInProgress: true });
    expect(useAnalyzerStore.getState().testState.dryRunInProgress).toBe(true);
  });
});

describe('analyzerStore — notebookLM slice', () => {
  it('starts with defaults (20 minutes, gemini-3.1-pro)', () => {
    const { notebookLM } = useAnalyzerStore.getState();
    expect(notebookLM.podcastDuration).toBe(20);
    expect(notebookLM.notebookLMModel).toBe('gemini-3.1-pro');
    expect(notebookLM.notebookLMStatus).toBe('');
    expect(notebookLM.notebookLMContent).toBeNull();
    expect(notebookLM.notebookLMGenerating).toBe(false);
    expect(notebookLM.enableHallucinationCheck).toBe(true);
    expect(notebookLM.hallucinationWarning).toBeNull();
  });

  it('has per-field setters', () => {
    const s = useAnalyzerStore.getState();
    s.setPodcastDuration(30);
    s.setNotebookLMModel('claude-opus-4.6');
    s.setNotebookLMStatus('running');
    s.setNotebookLMContent('markdown');
    s.setNotebookLMGenerating(true);
    s.setEnableHallucinationCheck(false);
    s.setHallucinationWarning({ issues: ['one'] });
    const s2 = useAnalyzerStore.getState();
    expect(s2.notebookLM.podcastDuration).toBe(30);
    expect(s2.notebookLM.notebookLMModel).toBe('claude-opus-4.6');
    expect(s2.notebookLM.notebookLMStatus).toBe('running');
    expect(s2.notebookLM.notebookLMContent).toBe('markdown');
    expect(s2.notebookLM.notebookLMGenerating).toBe(true);
    expect(s2.notebookLM.enableHallucinationCheck).toBe(false);
    expect(s2.notebookLM.hallucinationWarning).toEqual({ issues: ['one'] });
  });
});

describe('analyzerStore — briefingUI slice', () => {
  it('starts with no synthesis in progress', () => {
    const { briefingUI } = useAnalyzerStore.getState();
    expect(briefingUI.synthesizing).toBe(false);
    expect(briefingUI.synthesisError).toBeNull();
    expect(briefingUI.briefingCheckResult).toBeNull();
    expect(briefingUI.briefingStage).toBeNull();
    expect(briefingUI.quickSummariesById).toEqual({});
    expect(briefingUI.fullReportsById).toEqual({});
  });

  it('has per-field setters', () => {
    const s = useAnalyzerStore.getState();
    s.setSynthesizing(true);
    s.setSynthesisError('oops');
    s.setBriefingCheckResult({ verdict: 'YES' });
    s.setBriefingStage('checking');
    s.setQuickSummariesById({ '2504.01234': 'summary' });
    s.setFullReportsById({ '2504.01234': 'full report' });
    const s2 = useAnalyzerStore.getState();
    expect(s2.briefingUI.synthesizing).toBe(true);
    expect(s2.briefingUI.synthesisError).toBe('oops');
    expect(s2.briefingUI.briefingCheckResult).toEqual({ verdict: 'YES' });
    expect(s2.briefingUI.briefingStage).toBe('checking');
    expect(s2.briefingUI.quickSummariesById).toEqual({ '2504.01234': 'summary' });
    expect(s2.briefingUI.fullReportsById).toEqual({ '2504.01234': 'full report' });
  });
});

describe('analyzerStore — processingTiming slice', () => {
  it('starts with all nulls', () => {
    const { processingTiming } = useAnalyzerStore.getState();
    expect(processingTiming.startTime).toBeNull();
    expect(processingTiming.endTime).toBeNull();
    expect(processingTiming.duration).toBeNull();
  });

  it('setProcessingTiming accepts a patch', () => {
    const now = new Date();
    useAnalyzerStore.getState().setProcessingTiming({ startTime: now });
    expect(useAnalyzerStore.getState().processingTiming.startTime).toBe(now);
  });
});

describe('analyzerStore — auth slice', () => {
  it('starts unauthenticated', () => {
    const s = useAnalyzerStore.getState();
    expect(s.password).toBe('');
    expect(s.isAuthenticated).toBe(false);
  });

  it('setPassword and setIsAuthenticated work independently', () => {
    useAnalyzerStore.getState().setPassword('hunter2');
    useAnalyzerStore.getState().setIsAuthenticated(true);
    const s = useAnalyzerStore.getState();
    expect(s.password).toBe('hunter2');
    expect(s.isAuthenticated).toBe(true);
  });
});

describe('analyzerStore — reactContext slice', () => {
  it('starts with all nulls', () => {
    const { reactContext } = useAnalyzerStore.getState();
    expect(reactContext.profile).toBeNull();
    expect(reactContext.currentBriefing).toBeNull();
    expect(reactContext.feedback).toBeNull();
    expect(reactContext.config).toBeNull();
  });

  it('setReactContext accepts a patch', () => {
    useAnalyzerStore.getState().setReactContext({ profile: { content: 'hi' } });
    expect(useAnalyzerStore.getState().reactContext.profile).toEqual({ content: 'hi' });
    // Other fields preserved
    expect(useAnalyzerStore.getState().reactContext.currentBriefing).toBeNull();
  });

  it('setReactContext accepts a functional updater', () => {
    useAnalyzerStore.getState().setReactContext({ profile: { content: 'a' } });
    useAnalyzerStore
      .getState()
      .setReactContext((prev) => ({ ...prev, currentBriefing: { date: '2025-01-01' } }));
    const s = useAnalyzerStore.getState();
    expect(s.reactContext.profile).toEqual({ content: 'a' });
    expect(s.reactContext.currentBriefing).toEqual({ date: '2025-01-01' });
  });
});

describe('analyzerStore — resetStore', () => {
  it('restores all slices to pristine initial values', () => {
    // Pollute every slice
    const s = useAnalyzerStore.getState();
    s.setProcessing({ stage: 'running', isRunning: true });
    s.setResults({ allPapers: [{ id: 'x' }] });
    s.setFilterResults({ yes: [{ id: 'y' }] });
    s.setProcessingTiming({ startTime: new Date() });
    s.setTestState({ dryRunInProgress: true });
    s.setPodcastDuration(99);
    s.setSynthesizing(true);
    s.setPassword('leaked');
    s.setIsAuthenticated(true);
    s.setReactContext({ profile: { content: 'leaked' } });

    // Reset
    useAnalyzerStore.getState().resetStore();

    // Verify every slice is back to initial
    const out = useAnalyzerStore.getState();
    expect(out.processing.stage).toBe('idle');
    expect(out.processing.isRunning).toBe(false);
    expect(out.results.allPapers).toEqual([]);
    expect(out.filterResults.yes).toEqual([]);
    expect(out.processingTiming.startTime).toBeNull();
    expect(out.testState.dryRunInProgress).toBe(false);
    expect(out.notebookLM.podcastDuration).toBe(20);
    expect(out.briefingUI.synthesizing).toBe(false);
    expect(out.password).toBe('');
    expect(out.isAuthenticated).toBe(false);
    expect(out.reactContext.profile).toBeNull();
  });

  it('preserves action identities (actions are still callable after reset)', () => {
    const before = useAnalyzerStore.getState().setProcessing;
    useAnalyzerStore.getState().resetStore();
    const after = useAnalyzerStore.getState().setProcessing;
    expect(after).toBe(before);
    // And it still works
    after({ stage: 'fetching' });
    expect(useAnalyzerStore.getState().processing.stage).toBe('fetching');
  });
});
