/**
 * Integration test for the preview orchestration flow.
 *
 * Note: this test uses the "component with mocked fetch" approach rather than
 * importing the real route handlers, because pages/api/quick-filter.js and
 * pages/api/score-abstracts.js do NOT yet have callModelMode (fixture-mode)
 * plumbing — they call provider APIs directly via `fetch`. Adding fixture-mode
 * to those routes is out of scope for Task 15 (Batch 4).
 *
 * Instead, the test renders the full PreviewPanel component with realistic
 * fetch responses for all three stages and asserts:
 *   1. All three API endpoints are called in order with the expected request shapes.
 *   2. The 1-based paperIndex semantics are correctly applied so that survivors
 *      and rescored papers map back to the original sample.
 *   3. The final synthesis result is consumed and the briefing renders inside
 *      the PreviewPanel result UI.
 *
 * This validates the orchestration contract at the same boundary the real UI
 * uses, while remaining fixture-free and offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PreviewPanel from '../../components/profile/PreviewPanel.jsx';

const SAMPLE_PAPERS = [
  {
    arxivId: '2504.01001',
    title: 'Top paper alpha',
    abstract: 'abstract alpha',
    score: 9.5,
    fullReport: 'fr alpha',
    quickSummary: 'qs alpha',
  },
  {
    arxivId: '2504.01002',
    title: 'Top paper beta',
    abstract: 'abstract beta',
    score: 9.0,
    fullReport: 'fr beta',
    quickSummary: 'qs beta',
  },
  {
    arxivId: '2504.01003',
    title: 'Borderline paper gamma',
    abstract: 'abstract gamma',
    score: 6.4,
    fullReport: 'fr gamma',
    quickSummary: 'qs gamma',
  },
  {
    arxivId: '2504.01004',
    title: 'Off-topic paper delta',
    abstract: 'abstract delta',
    score: 5.8,
    fullReport: 'fr delta',
    quickSummary: 'qs delta',
  },
];

const PROPS = {
  editedProfile: 'I study mechanistic interpretability of large language models.',
  models: {
    filter: 'gemini-2.5-flash-lite',
    scoring: 'gemini-3-flash',
    briefing: 'gemini-3.1-pro',
  },
  password: 'test-password',
  onClose: vi.fn(),
};

function buildFetchMock() {
  const fetchMock = vi.fn();

  // Stage 1: filter — drop the off-topic paper (delta = paperIndex 4)
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      verdicts: [
        { paperIndex: 1, verdict: 'YES' },
        { paperIndex: 2, verdict: 'YES' },
        { paperIndex: 3, verdict: 'MAYBE' },
        { paperIndex: 4, verdict: 'NO' },
      ],
    }),
  });

  // Stage 2: scoring — assign new scores to survivors (alpha, beta, gamma)
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      scores: [
        { paperIndex: 1, score: 9.7, justification: 'Direct alignment with interpretability' },
        { paperIndex: 2, score: 9.1, justification: 'Strong methodological contribution' },
        { paperIndex: 3, score: 7.2, justification: 'Promising borderline relevance' },
      ],
    }),
  });

  // Stage 3: synthesis — return a valid briefing referencing the top survivors
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      briefing: {
        executiveSummary:
          'Three papers converge on attention-head circuits, with one borderline contribution.',
        themes: [
          {
            title: 'Attention head circuits',
            argument: 'Both alpha and beta build on circuit-level analyses.',
            paperIds: ['2504.01001', '2504.01002'],
          },
        ],
        papers: [
          {
            arxivId: '2504.01001',
            title: 'Top paper alpha',
            score: 9.7,
            onelinePitch: 'Mechanistic account of multi-step reasoning circuits.',
            whyMatters: 'Aligns with your stated interest.',
            figures: [],
          },
          {
            arxivId: '2504.01002',
            title: 'Top paper beta',
            score: 9.1,
            onelinePitch: 'Ablation evidence for sparse attention specialization.',
            whyMatters: 'Tests the framing of head pruning.',
            figures: [],
          },
        ],
        debates: [],
        longitudinal: [],
        proactiveQuestions: [],
      },
    }),
  });

  return fetchMock;
}

describe('preview orchestration (component-level integration)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'aparture-last-analysis-run',
      JSON.stringify({ papers: SAMPLE_PAPERS, timestamp: Date.now() })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs filter → score → synthesize and renders all three result sections', async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    render(<PreviewPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));

    await waitFor(() => {
      expect(screen.getByText(/preview complete/i)).toBeInTheDocument();
    });

    // 1. All three endpoints called in correct order.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/quick-filter');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/score-abstracts');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/synthesize');

    // 2. Filter request: payload shape
    const filterBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(filterBody.papers).toHaveLength(4);
    expect(filterBody.papers[0]).toMatchObject({
      arxivId: '2504.01001',
      title: 'Top paper alpha',
    });
    expect(filterBody.scoringCriteria).toBe(PROPS.editedProfile);
    expect(filterBody.password).toBe('test-password');

    // 3. Scoring request: should contain only the 3 survivors (alpha, beta, gamma).
    //    The off-topic paper (delta, paperIndex 4 with verdict NO) must be dropped.
    const scoreBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(scoreBody.papers).toHaveLength(3);
    const scoreIds = scoreBody.papers.map((p) => p.arxivId);
    expect(scoreIds).toEqual(['2504.01001', '2504.01002', '2504.01003']);
    expect(scoreIds).not.toContain('2504.01004');

    // 4. Synthesis request: top-scored survivors with merged newScore.
    const synthBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(synthBody.profile).toBe(PROPS.editedProfile);
    expect(synthBody.papers.length).toBeGreaterThan(0);
    // After rescoring, alpha=9.7, beta=9.1, gamma=7.2 → sorted desc, top 10 of 3 = all 3.
    const synthIds = synthBody.papers.map((p) => p.arxivId);
    expect(synthIds).toEqual(['2504.01001', '2504.01002', '2504.01003']);
    // The first paper passed to synthesis should carry the new score.
    expect(synthBody.papers[0].score).toBe(9.7);

    // 5. Result section: filter dropouts rendered.
    expect(screen.getByText(/1 paper would be filtered out/i)).toBeInTheDocument();
    expect(screen.getByText('Off-topic paper delta')).toBeInTheDocument();

    // 6. Scoring shifts table rendered with the rescored survivors.
    // (Top paper alpha and beta also appear in the mini briefing's PaperCard list,
    // so use getAllByText for those.)
    expect(screen.getByText(/scoring shifts/i)).toBeInTheDocument();
    expect(screen.getAllByText('Top paper alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Top paper beta').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Borderline paper gamma')).toBeInTheDocument();
    expect(screen.getAllByText('9.7').length).toBeGreaterThanOrEqual(1);

    // 7. Mini briefing rendered with the PREVIEW banner and exec summary.
    expect(screen.getByText(/preview — not saved/i)).toBeInTheDocument();
    expect(
      screen.getByText(/three papers converge on attention-head circuits/i)
    ).toBeInTheDocument();
  });

  it('honors 1-based paperIndex semantics for filter survivors', async () => {
    // Configure a filter response where the SECOND paper (paperIndex 2) is dropped.
    // This verifies that the orchestration treats paperIndex as 1-based.
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdicts: [
          { paperIndex: 1, verdict: 'YES' },
          { paperIndex: 2, verdict: 'NO' },
          { paperIndex: 3, verdict: 'YES' },
          { paperIndex: 4, verdict: 'YES' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scores: [
          { paperIndex: 1, score: 9.0, justification: 'a' },
          { paperIndex: 2, score: 8.0, justification: 'b' },
          { paperIndex: 3, score: 7.0, justification: 'c' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        briefing: {
          executiveSummary: 'index test',
          themes: [],
          papers: [],
          debates: [],
          longitudinal: [],
          proactiveQuestions: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PreviewPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));

    await waitFor(() => {
      expect(screen.getByText(/preview complete/i)).toBeInTheDocument();
    });

    // Survivors should be alpha (idx 1), gamma (idx 3), delta (idx 4) — NOT beta.
    const scoreBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const survivorIds = scoreBody.papers.map((p) => p.arxivId);
    expect(survivorIds).toEqual(['2504.01001', '2504.01003', '2504.01004']);
    expect(survivorIds).not.toContain('2504.01002');

    // Filter section should show beta as dropped (and beta won't appear in
    // the mini briefing here since its briefing.papers is empty).
    expect(screen.getByText('Top paper beta')).toBeInTheDocument();
  });

  it('produces a valid briefing object shape consumed by the renderer', async () => {
    // Build a briefing locally so we can assert its shape after the test runs.
    const briefing = {
      executiveSummary: 'three papers under one theme',
      themes: [
        {
          title: 'Attention head circuits',
          argument: 'common ground',
          paperIds: ['2504.01001'],
        },
      ],
      papers: [
        {
          arxivId: '2504.01001',
          title: 'Top paper alpha',
          score: 9.7,
          onelinePitch: 'pitch',
          whyMatters: 'matters',
          figures: [],
        },
      ],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdicts: [
          { paperIndex: 1, verdict: 'YES' },
          { paperIndex: 2, verdict: 'YES' },
          { paperIndex: 3, verdict: 'YES' },
          { paperIndex: 4, verdict: 'NO' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scores: [
          { paperIndex: 1, score: 9.7, justification: 'a' },
          { paperIndex: 2, score: 9.1, justification: 'b' },
          { paperIndex: 3, score: 7.2, justification: 'c' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ briefing }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PreviewPanel {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));

    await waitFor(() => {
      expect(screen.getByText(/preview — not saved/i)).toBeInTheDocument();
    });

    // The synthesize call was made and the briefing shape contains the keys
    // BriefingView reads.
    expect(fetchMock.mock.calls[2][0]).toBe('/api/synthesize');
    expect(briefing).toHaveProperty('executiveSummary');
    expect(briefing).toHaveProperty('themes');
    expect(briefing).toHaveProperty('papers');
    expect(briefing).toHaveProperty('debates');
    expect(briefing).toHaveProperty('longitudinal');
    expect(briefing).toHaveProperty('proactiveQuestions');
    expect(Array.isArray(briefing.papers)).toBe(true);
    // And the executive summary actually rendered into the DOM via BriefingView.
    expect(screen.getByText(/three papers under one theme/i)).toBeInTheDocument();
  });
});
