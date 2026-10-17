// App runs an automatic proposal round after a real briefing is saved, and
// never after a test briefing. Unit tests of the gate and the round can't
// see that seam.
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

const ANSWER = {
  id: 'ans-1',
  type: 'answer',
  questionId: 'q1',
  question: 'Should flow-matching papers count as core?',
  answer: 'Yes',
  briefingDate: '2026-10-16',
  timestamp: Date.now() - 1000,
};

let suggestCalls;
beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('aparture-feedback', JSON.stringify({ events: [ANSWER] }));
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({ isAuthenticated: true, password: 'pw' });
  suggestCalls = 0;
  vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    if (String(url).includes('/api/suggest-profile')) {
      suggestCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          changes: [],
          noteChanges: [
            {
              id: 'n1',
              rationale: 'Your answer "Yes" on flow matching.',
              action: 'add',
              noteId: null,
              scope: 'selection',
              text: 'Flow-matching papers count as core.',
            },
          ],
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ ids: [], entries: [] }) };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  useAnalyzerStore.setState(initialState());
});

async function saveBriefing(testMode) {
  render(<App />);
  await waitFor(() => expect(useAnalyzerStore.getState().reactContext.seenPapersReady).toBe(true));
  await act(async () => {
    await useAnalyzerStore.getState().reactContext.saveBriefing(
      localDateStr(),
      { executiveSummary: 'x', themes: [], papers: [] },
      {
        testMode,
      }
    );
  });
}

const stored = () => JSON.parse(window.localStorage.getItem('aparture-auto-proposals') ?? 'null');

describe('App — automatic proposals', () => {
  it('a real briefing with a pending answer prepares proposals', async () => {
    await saveBriefing(false);
    await waitFor(() => expect(stored()?.pending).toBeTruthy());
    expect(suggestCalls).toBe(1);
    expect(stored().pending.response.noteChanges[0].note.text).toBe(
      'Flow-matching papers count as core.'
    );
    expect(stored().evaluatedIds).toEqual(['ans-1']);
  });

  it('a test briefing never asks', async () => {
    await saveBriefing(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(suggestCalls).toBe(0);
    expect(stored()).toBeNull();
  });

  it('the setting turns it off', async () => {
    window.localStorage.setItem(
      'arxivAnalyzerState',
      JSON.stringify({ config: { version: 11, autoProposals: false } })
    );
    await saveBriefing(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(suggestCalls).toBe(0);
  });
});
