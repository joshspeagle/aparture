// Which briefing the main area shows, and whether it is still loading. App
// tags each fetch result with the id it was for and derives the status from
// that tag, so a result that lands after the reader moved on must not show.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
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

const sidebar = { props: null };
vi.mock('../../../components/shell/Sidebar.jsx', () => ({
  default: (props) => {
    sidebar.props = props;
    return null;
  },
}));
vi.mock('../../../components/shell/MobileTopBar.jsx', () => ({ default: () => null }));
vi.mock('../../../components/profile/SuggestDialog.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shell/MainArea.jsx', () => ({
  default: ({ selectedStatus, selectedEntry }) => (
    <div data-testid="view">{`${selectedStatus}:${selectedEntry?.id ?? ''}`}</div>
  ),
}));

import App from '../../../components/shell/App.jsx';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
let slowResponse;

beforeEach(() => {
  window.localStorage.clear();
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({ isAuthenticated: true, password: 'pw' });
  slowResponse = null;
  vi.spyOn(global, 'fetch').mockImplementation((url, init) => {
    if (!init?.method || init.method === 'GET') {
      if (String(url).endsWith('/api/briefings/missing')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }
      if (String(url).endsWith('/api/briefings/slow')) {
        return new Promise((resolve) => {
          slowResponse = () => resolve(ok({ id: 'slow', briefing: { papers: [] } }));
        });
      }
    }
    return Promise.resolve(ok({ ids: [], entries: [] }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  useAnalyzerStore.setState(initialState());
});

const shown = () => screen.getByTestId('view').textContent;
const select = (view) => act(() => sidebar.props.onSelectView(view));

async function renderWithSavedBriefing() {
  render(<App />);
  await waitFor(() => expect(useAnalyzerStore.getState().reactContext.seenPapersReady).toBe(true));
  let id;
  await act(async () => {
    id = await useAnalyzerStore
      .getState()
      .reactContext.saveBriefing(
        localDateStr(),
        { executiveSummary: 'x', themes: [], papers: [] },
        { testMode: false }
      );
  });
  return id;
}

describe('App — briefing view loading', () => {
  it('saving a briefing switches to it and loads it', async () => {
    const id = await renderWithSavedBriefing();
    await waitFor(() => expect(shown()).toBe(`loaded:${id}`));
  });

  it('an unknown id ends as not-found, and switching back loads the briefing again', async () => {
    const id = await renderWithSavedBriefing();
    select('briefing:missing');
    expect(shown()).toBe('loading:');
    await waitFor(() => expect(shown()).toBe('not-found:'));
    select(`briefing:${id}`);
    expect(shown()).toBe('loading:');
    await waitFor(() => expect(shown()).toBe(`loaded:${id}`));
  });

  it('a non-briefing view is idle', async () => {
    await renderWithSavedBriefing();
    select('settings');
    expect(shown()).toBe('idle:');
  });

  it('a fetch that lands after the reader moved on does not replace the newer result', async () => {
    await renderWithSavedBriefing();
    select('briefing:slow');
    expect(shown()).toBe('loading:');
    select('briefing:missing');
    await waitFor(() => expect(shown()).toBe('not-found:'));
    await act(async () => slowResponse());
    expect(shown()).toBe('not-found:');
  });
});
