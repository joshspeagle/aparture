// App-level wiring for the feedback → profile loop. MainArea / Sidebar /
// SuggestDialog / pipeline are stubbed; the stubs capture the props App hands
// them so each test can drive App's real handlers directly.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';
import { localDateStr } from '../../../lib/dates.js';

const { captured } = vi.hoisted(() => ({ captured: { mainArea: null, suggestDialog: null } }));

vi.mock('../../../lib/analyzer/briefingClient.js', () => ({
  runBriefingGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/analyzer/pipeline.js', () => ({
  createAnalysisPipeline: () => ({
    startProcessing: vi.fn(),
    runDryRunTest: vi.fn(),
    runMinimalTest: vi.fn(),
    generateNotebookLM: vi.fn(),
    skipRemainingGates: vi.fn(),
  }),
}));

vi.mock('../../../components/shell/Sidebar.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shell/MobileTopBar.jsx', () => ({ default: () => null }));
vi.mock('../../../components/profile/SuggestDialog.jsx', () => ({
  default: (props) => {
    captured.suggestDialog = props;
    return null;
  },
}));
vi.mock('../../../components/shell/MainArea.jsx', () => ({
  default: (props) => {
    captured.mainArea = props;
    return null;
  },
}));

import App from '../../../components/shell/App.jsx';

const storedEvents = () =>
  JSON.parse(window.localStorage.getItem('aparture-feedback') ?? '{"events":[]}').events;

function seedStore(patch = {}) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    isAuthenticated: true,
    password: 'pw',
    filterResults: {
      total: 2,
      yes: [
        {
          id: 'y1',
          arxivId: '2610.00001',
          title: 'Kept paper',
          filterVerdict: 'YES',
          originalVerdict: 'YES',
        },
      ],
      maybe: [],
      no: [
        {
          id: 'n1',
          arxivId: '2610.00002',
          title: 'Rejected paper',
          filterVerdict: 'NO',
          originalVerdict: 'NO',
          filterSummary: 'Applies SBI to strong lensing.',
          filterJustification: 'Profile does not mention lensing.',
        },
      ],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
    },
    ...patch,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  captured.mainArea = null;
  captured.suggestDialog = null;
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ids: [], entries: [] }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  useAnalyzerStore.setState(initialState());
});

describe('App — filter overrides are recorded at click time (P1-6)', () => {
  it('records an override made after the run has ended (no scoring pass follows)', () => {
    // Post-run: processing.isRunning is false, so FilterResultsList
    // re-enables the pills. Pre-fix, these clicks moved the paper but no
    // event was ever written — recording only happened when scoring began.
    seedStore();
    render(<App />);

    act(() => {
      captured.mainArea.onSetVerdict('n1', 'NO', 'YES');
    });

    const overrides = storedEvents().filter((e) => e.type === 'filter-override');
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toMatchObject({
      arxivId: '2610.00002',
      paperTitle: 'Rejected paper',
      originalVerdict: 'NO',
      newVerdict: 'YES',
      summary: 'Applies SBI to strong lensing.',
      justification: 'Profile does not mention lensing.',
      briefingDate: localDateStr(),
    });
    // The paper moved buckets as before.
    const { filterResults } = useAnalyzerStore.getState();
    expect(filterResults.yes.map((p) => p.id)).toContain('n1');
  });

  it('cycling back to the original verdict removes the override (latest-wins)', () => {
    seedStore();
    render(<App />);

    act(() => {
      captured.mainArea.onSetVerdict('n1', 'NO', 'MAYBE');
    });
    act(() => {
      captured.mainArea.onSetVerdict('n1', 'MAYBE', 'YES');
    });
    let overrides = storedEvents().filter((e) => e.type === 'filter-override');
    expect(overrides).toHaveLength(1);
    expect(overrides[0].newVerdict).toBe('YES');

    act(() => {
      captured.mainArea.onSetVerdict('n1', 'YES', 'NO');
    });
    overrides = storedEvents().filter((e) => e.type === 'filter-override');
    expect(overrides).toEqual([]);
  });

  it('never records an override for a paper whose stored verdict is invalid', () => {
    seedStore({
      filterResults: {
        total: 1,
        yes: [],
        maybe: [],
        // A session restored from an old dry run: originalVerdict 123.
        no: [{ id: 'n9', arxivId: '2610.00009', title: 'Old dry-run paper', originalVerdict: 123 }],
        inProgress: false,
        currentBatch: 0,
        totalBatches: 0,
      },
    });
    render(<App />);
    act(() => {
      captured.mainArea.onSetVerdict('n9', 'NO', 'YES');
    });
    expect(storedEvents()).toEqual([]);
  });
});
