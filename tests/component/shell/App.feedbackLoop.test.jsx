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

  it("tags a post-run override on a dry run's buckets as test feedback", () => {
    // The dry run has ended (dryRunInProgress false), but the buckets still
    // hold its mock verdicts — results.fromDryRun says so.
    seedStore({ results: { ...initialState().results, fromDryRun: true } });
    render(<App />);
    act(() => {
      captured.mainArea.onSetVerdict('n1', 'NO', 'YES');
    });
    const [event] = storedEvents();
    expect(event.type).toBe('filter-override');
    expect(event.testMode).toBe(true);
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

describe('App — the Gate 3 note keeps its origin (P1-7)', () => {
  it("forwards the note's options so the stored comment is tagged pre-briefing", () => {
    seedStore();
    render(<App />);
    act(() => {
      captured.mainArea.onAddGeneralComment('Lead with the flows cluster.', undefined, {
        origin: 'pre-briefing',
      });
    });
    const [event] = storedEvents();
    expect(event).toMatchObject({
      type: 'general-comment',
      text: 'Lead with the flows cluster.',
      origin: 'pre-briefing',
      briefingDate: localDateStr(),
    });
  });
});

describe('App — Suggest outcome and revert keep feedback status honest (P1-4)', () => {
  const storedProfile = () => JSON.parse(window.localStorage.getItem('aparture-profile'));
  const star = (id, timestamp) => ({
    id,
    type: 'star',
    arxivId: `2610.${id}`,
    paperTitle: `Paper ${id}`,
    timestamp,
    briefingDate: '2026-10-17',
  });

  beforeEach(() => {
    window.localStorage.setItem(
      'aparture-profile',
      JSON.stringify({ content: 'my profile', updatedAt: 1, lastFeedbackCutoff: 0, revisions: [] })
    );
    window.localStorage.setItem(
      'aparture-feedback',
      JSON.stringify({ events: [star('used', 100), star('unused', 200)] })
    );
  });

  it('an accepted change saves the profile and incorporates only its events; reverting re-opens them', () => {
    seedStore();
    render(<App />);
    const appliedAt = Date.now();

    act(() => {
      captured.suggestDialog.onAccept({
        kind: 'applied',
        content: 'my profile, sharpened',
        rationale: '• Based on the star on 2610.used',
        accepted: [{ id: 'c1' }],
        rejected: [],
        incorporatedEventIds: ['used'],
        appliedAt,
      });
    });

    expect(storedProfile().content).toBe('my profile, sharpened');
    let events = storedEvents();
    expect(events.find((e) => e.id === 'used').incorporatedAt).toBe(appliedAt);
    expect(events.find((e) => e.id === 'unused').incorporatedAt).toBeUndefined();
    // The dialog's pending list now holds only the unused event.
    expect(captured.suggestDialog.newFeedback.map((e) => e.id)).toEqual(['unused']);

    // Revert to the revision the suggestion archived (createdAt = appliedAt).
    act(() => {
      captured.mainArea.revertToRevision(appliedAt);
    });
    expect(storedProfile().content).toBe('my profile');
    events = storedEvents();
    expect(events.find((e) => e.id === 'used').incorporatedAt).toBeUndefined();
    expect(captured.suggestDialog.newFeedback.map((e) => e.id).sort()).toEqual(['unused', 'used']);
  });

  it('a rejected change is remembered and handed to the next Suggest round (P1-5)', () => {
    seedStore();
    render(<App />);
    const rejectedChange = {
      id: 'c9',
      rationale: 'Based on the dismiss on 2610.unused',
      edit: { type: 'delete', anchor: 'my ', content: '' },
    };
    act(() => {
      captured.suggestDialog.onAccept({
        kind: 'rejected',
        content: 'my profile',
        accepted: [],
        rejected: [rejectedChange],
        incorporatedEventIds: [],
        appliedAt: 4242,
      });
    });
    expect(storedProfile().content).toBe('my profile');
    expect(storedProfile().suggestionStats).toEqual({ accepted: 0, rejected: 1, noChange: 0 });
    expect(captured.suggestDialog.rejectedSuggestions).toEqual([
      {
        rationale: 'Based on the dismiss on 2610.unused',
        edit: { type: 'delete', anchor: 'my ', content: '' },
        rejectedAt: 4242,
      },
    ]);
  });

  it('a no-change result marks nothing incorporated', () => {
    seedStore();
    render(<App />);
    act(() => {
      captured.suggestDialog.onAccept({
        kind: 'no-change',
        noChangeReason: 'covered',
        accepted: [],
        rejected: [],
        incorporatedEventIds: [],
        appliedAt: Date.now(),
      });
    });
    expect(storedProfile().content).toBe('my profile');
    expect(storedEvents().every((e) => e.incorporatedAt === undefined)).toBe(true);
    expect(captured.suggestDialog.newFeedback).toHaveLength(2);
  });
});
