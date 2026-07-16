// Manual "Generate Briefing" path (C2) + Reset completeness (C6b).
//
// The manual path historically drifted from the pipeline's auto-run:
// testMode read the live dryRunInProgress flag (always false at the first
// clickable moment), feedback/filterResults never reached the synthesizer,
// no mockTester was passed (real billed calls over mock data), and a dead
// briefingHistory argument churned the callback deps. These tests pin the
// rebuilt wiring: run-origin testMode/mockTester, engagement + archive
// pass-through, and no dead arguments.
//
// MainArea/Sidebar/pipeline are stubbed so the test drives App's handlers
// directly without the full UI tree.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';
import { localDateStr } from '../../../lib/dates.js';

const { sentinelTester } = vi.hoisted(() => ({ sentinelTester: { __sentinelMockTester: true } }));

vi.mock('../../../lib/analyzer/briefingClient.js', () => ({
  runBriefingGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/analyzer/pipeline.js', () => ({
  createAnalysisPipeline: ({ mockAPITesterRef }) => ({
    startProcessing: vi.fn(),
    // Simulate what the real runDryRunTest does first: install a mock tester
    // on the shared ref. The manual-generate path must hand THIS instance to
    // runBriefingGeneration when the results came from a dry run.
    runDryRunTest: vi.fn(() => {
      mockAPITesterRef.current = sentinelTester;
    }),
    runMinimalTest: vi.fn(),
    generateNotebookLM: vi.fn(),
    skipRemainingGates: vi.fn(),
  }),
}));

vi.mock('../../../components/shell/Sidebar.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shell/MobileTopBar.jsx', () => ({ default: () => null }));
vi.mock('../../../components/profile/SuggestDialog.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shell/MainArea.jsx', () => ({
  default: (props) => (
    <div>
      <button onClick={props.onGenerateBriefing}>trigger-generate</button>
      <button onClick={props.onRunDryRun}>trigger-dryrun</button>
      <button onClick={props.onReset}>trigger-reset</button>
    </div>
  ),
}));

import App from '../../../components/shell/App.jsx';
import { runBriefingGeneration } from '../../../lib/analyzer/briefingClient.js';

const seededFeedbackEvent = {
  id: 'evt-1',
  type: 'star',
  arxivId: '2605.0001',
  paperTitle: 'Seeded Paper',
  timestamp: 1752541200000,
};

function seedStore({ fromDryRun }) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    isAuthenticated: true,
    password: 'pw',
    results: {
      allPapers: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      scoredPapers: [{ id: 'a', relevanceScore: 8 }],
      finalRanking: [{ id: 'a', arxivId: '2605.0001', title: 'Seeded Paper', finalScore: 8 }],
      fromDryRun,
    },
    filterResults: {
      total: 3,
      yes: [{ id: 'a' }],
      maybe: [{ id: 'b' }],
      no: [{ id: 'c' }],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(
    'aparture-feedback',
    JSON.stringify({ events: [seededFeedbackEvent] })
  );
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ids: [], entries: [] }),
  });
  runBriefingGeneration.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  useAnalyzerStore.setState(initialState());
});

describe('App — manual Generate Briefing (C2)', () => {
  it('passes feedbackEvents, filterResults, addStatus, an abort signal — and no briefingHistory', async () => {
    seedStore({ fromDryRun: false });
    render(<App />);

    fireEvent.click(screen.getByText('trigger-generate'));

    await waitFor(() => expect(runBriefingGeneration).toHaveBeenCalledTimes(1));
    const call = runBriefingGeneration.mock.calls[0][0];

    // Engagement + pipeline archive reach the synthesizer like the auto path.
    expect(call.feedbackEvents).toEqual([seededFeedbackEvent]);
    expect(call.filterResults.yes).toEqual([{ id: 'a' }]);
    expect(call.filterResults.maybe).toEqual([{ id: 'b' }]);
    expect(call.filterResults.no).toEqual([{ id: 'c' }]);

    // Status sink + cancellation signal are wired.
    expect(typeof call.addStatus).toBe('function');
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.abortSignal.aborted).toBe(false);

    // The dead argument is gone.
    expect(call).not.toHaveProperty('briefingHistory');

    // Live (real-run) results: no mock tester, not test mode.
    expect(call.mockTester).toBeNull();
    expect(call.generationMetadata.testMode).toBe(false);
    // Metadata superset from the shared builder (previously drifted fields).
    expect(call.generationMetadata).toHaveProperty('pauseBeforeBriefing');
    expect(call.generationMetadata.papersScreened).toBe(3);
    expect(call.generationMetadata.filterVerdictCounts).toEqual({ yes: 1, maybe: 1, no: 1 });
  });

  it('marks testMode and hands over the mock tester when the results came from a dry run', async () => {
    seedStore({ fromDryRun: true });
    render(<App />);

    // Install the mock tester the way a real dry run does.
    fireEvent.click(screen.getByText('trigger-dryrun'));
    fireEvent.click(screen.getByText('trigger-generate'));

    await waitFor(() => expect(runBriefingGeneration).toHaveBeenCalledTimes(1));
    const call = runBriefingGeneration.mock.calls[0][0];

    expect(call.generationMetadata.testMode).toBe(true);
    expect(call.mockTester).toBe(sentinelTester);
  });

  it('run-origin beats the live dryRunInProgress flag (false at the first clickable moment)', async () => {
    seedStore({ fromDryRun: true });
    // Simulate the post-run state: the dry run already ended.
    useAnalyzerStore.setState({
      testState: { ...useAnalyzerStore.getState().testState, dryRunInProgress: false },
    });
    render(<App />);
    fireEvent.click(screen.getByText('trigger-generate'));

    await waitFor(() => expect(runBriefingGeneration).toHaveBeenCalledTimes(1));
    expect(runBriefingGeneration.mock.calls[0][0].generationMetadata.testMode).toBe(true);
  });
});

describe('App — Reset clears run-scoped extras (C6b)', () => {
  it('clears skippedDueToRecaptcha, cost tracking, MS selections, and synthesisError', async () => {
    seedStore({ fromDryRun: false });
    useAnalyzerStore.getState().addSkippedDueToRecaptcha({
      id: 'x',
      arxivId: '2605.0009',
      title: 'Blocked Paper',
    });
    useAnalyzerStore.getState().addStageUsage('filter', 'gemini-3.5-flash', {
      tokensIn: 100,
      tokensOut: 10,
    });
    useAnalyzerStore.getState().msAddStar('a');
    useAnalyzerStore.getState().setSynthesisError('previous run exploded');

    render(<App />);
    fireEvent.click(screen.getByText('trigger-reset'));

    await waitFor(() => {
      const s = useAnalyzerStore.getState();
      expect(s.skippedDueToRecaptcha).toEqual([]);
      expect(s.costTracking.byStage).toEqual({});
      expect(s.msStarredIds.size).toBe(0);
      expect(s.briefingUI.synthesisError).toBeNull();
    });
  });
});

describe('App — briefing date convention (C1)', () => {
  it("todayStr shares lib/dates localDateStr (sidebar 'Today' + scoped feedback agree)", () => {
    // App derives its per-day feedback scoping from localDateStr; the
    // pipeline (startProcessing) and briefingClient now stamp the same local
    // day. This is a convention pin, not a behavior test.
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    expect(localDateStr()).toBe(expected);
  });
});
