// App-level wiring for duplicate detection. The dedupe index is fed from
// App's briefing-save wrapper and published to the pipeline through
// reactContext; unit tests of useSeenPapers and applyDedupe can't see either
// seam, so removing recordRun from the wrapper or dropping the index from the
// publish used to leave the whole suite green.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';
import { localDateStr } from '../../../lib/dates.js';

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
vi.mock('../../../components/profile/SuggestDialog.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shell/MainArea.jsx', () => ({ default: () => null }));

import App from '../../../components/shell/App.jsx';

const storedIndex = () =>
  JSON.parse(window.localStorage.getItem('aparture-seen-papers-index') ?? '{}');

beforeEach(() => {
  window.localStorage.clear();
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({ isAuthenticated: true, password: 'pw' });
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

async function renderReady() {
  render(<App />);
  // The one-time cold migration must finish first, or it would rebuild the
  // index over whatever the test records.
  await waitFor(() => expect(useAnalyzerStore.getState().reactContext.seenPapersReady).toBe(true));
  return useAnalyzerStore.getState().reactContext;
}

describe('App — seen-papers index wiring', () => {
  // The store starts with an empty index, so only papers recorded through
  // App prove the publish is wired.
  it('publishes the live index to the pipeline', async () => {
    const ctx = await renderReady();
    await act(async () => {
      await ctx.saveBriefing(
        localDateStr(),
        { executiveSummary: 'x', themes: [], papers: [{ arxivId: '2610.00004' }] },
        { testMode: false }
      );
    });
    await waitFor(() =>
      expect(useAnalyzerStore.getState().reactContext.seenPapersIndex).toHaveProperty('2610.00004')
    );
  });

  // Run under TZ=Pacific/Kiritimati (CI's UTC+14 leg), a local-time parse of
  // the briefing date files every paper under the previous day.
  it('saving a briefing records its briefed and filtered papers under the briefing date', async () => {
    const ctx = await renderReady();
    const date = localDateStr();
    await act(async () => {
      await ctx.saveBriefing(
        date,
        { executiveSummary: 'x', themes: [], papers: [{ arxivId: '2610.00001' }] },
        { testMode: false },
        { pipelineArchive: { filterResults: { yes: [], maybe: [], no: [{ id: '2610.00002' }] } } }
      );
    });
    expect(storedIndex()).toMatchObject({ '2610.00001': date, '2610.00002': date });
  });

  it('a dry-run briefing leaves the index alone', async () => {
    const ctx = await renderReady();
    await act(async () => {
      await ctx.saveBriefing(
        localDateStr(),
        { executiveSummary: 'x', themes: [], papers: [{ arxivId: '2610.00003' }] },
        { testMode: true }
      );
    });
    expect(storedIndex()['2610.00003']).toBeUndefined();
  });
});
