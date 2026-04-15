import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PreviewPanel, {
  selectPreviewSample,
  computeRankShifts,
} from '../../../components/profile/PreviewPanel.jsx';

describe('selectPreviewSample', () => {
  it('returns empty when input is empty', () => {
    expect(selectPreviewSample([])).toEqual([]);
  });

  it('picks top 10 by score when more than 10 papers exist', () => {
    const papers = Array.from({ length: 15 }, (_, i) => ({
      arxivId: `${i}`,
      score: i,
    }));
    const sample = selectPreviewSample(papers);
    const top = sample.slice(0, 10);
    // Highest score should be 14, lowest in top should be 5
    expect(top[0].score).toBe(14);
    expect(top[9].score).toBe(5);
  });

  it('includes up to 5 borderline (score 5-7) papers outside the top 10', () => {
    // 10 high-scorers (8-9) + 8 borderline (5-7) + 2 low (1-2)
    const papers = [
      ...Array.from({ length: 10 }, (_, i) => ({ arxivId: `hi${i}`, score: 8 + i * 0.1 })),
      ...Array.from({ length: 8 }, (_, i) => ({ arxivId: `bd${i}`, score: 5 + i * 0.2 })),
      { arxivId: 'lo1', score: 1 },
      { arxivId: 'lo2', score: 2 },
    ];
    const sample = selectPreviewSample(papers);
    // Should be 10 top + 5 borderline = 15 total
    expect(sample).toHaveLength(15);
    const borderline = sample.filter((p) => p.score >= 5.0 && p.score < 7.0);
    expect(borderline.length).toBeLessThanOrEqual(5);
  });

  it('returns fewer than 15 when borderline candidates are scarce', () => {
    // 10 top-scorers, no borderline
    const papers = Array.from({ length: 10 }, (_, i) => ({ arxivId: `${i}`, score: 9 }));
    expect(selectPreviewSample(papers)).toHaveLength(10);
  });

  it('does not double-count a paper that would appear in both top and borderline', () => {
    // 8 papers scoring exactly 7 (at the top boundary) + 2 scoring 6.5 (clearly borderline)
    // Only the 2 scoring 6.5 should end up in the borderline slot
    const papers = [
      ...Array.from({ length: 8 }, (_, i) => ({ arxivId: `t${i}`, score: 7.1 })),
      { arxivId: 'b1', score: 6.5 },
      { arxivId: 'b2', score: 6.0 },
    ];
    const sample = selectPreviewSample(papers);
    // Should have 8 top + 2 borderline
    expect(sample).toHaveLength(10);
  });
});

describe('PreviewPanel shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const defaultProps = {
    editedProfile: 'edited profile text',
    models: {
      filter: 'gemini-2.5-flash-lite',
      scoring: 'gemini-3-flash',
      briefing: 'gemini-3.1-pro',
    },
    password: 'test-password',
    onClose: vi.fn(),
  };

  it('shows a no-cache error when aparture-last-analysis-run is missing', () => {
    render(<PreviewPanel {...defaultProps} />);
    expect(screen.getByText(/no recent analysis/i)).toBeInTheDocument();
  });

  it('shows a Run preview button when cache is present', () => {
    window.localStorage.setItem(
      'aparture-last-analysis-run',
      JSON.stringify({
        papers: [
          { arxivId: 'x', score: 9, title: 't', abstract: 'a', fullReport: 'f', quickSummary: 'q' },
        ],
        timestamp: Date.now(),
      })
    );
    render(<PreviewPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /run preview/i })).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<PreviewPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('PreviewPanel orchestration', () => {
  const defaultProps = {
    editedProfile: 'edited profile text',
    models: {
      filter: 'gemini-2.5-flash-lite',
      scoring: 'gemini-3-flash',
      briefing: 'gemini-3.1-pro',
    },
    password: 'test-password',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'aparture-last-analysis-run',
      JSON.stringify({
        papers: [
          {
            arxivId: 'a',
            title: 'A',
            abstract: 'abs a',
            score: 9,
            fullReport: 'fr a',
            quickSummary: 'qs a',
          },
          {
            arxivId: 'b',
            title: 'B',
            abstract: 'abs b',
            score: 8,
            fullReport: 'fr b',
            quickSummary: 'qs b',
          },
          {
            arxivId: 'c',
            title: 'C',
            abstract: 'abs c',
            score: 6,
            fullReport: 'fr c',
            quickSummary: 'qs c',
          },
        ],
        timestamp: Date.now(),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls filter, score, and synthesize endpoints in order', async () => {
    const fetchMock = vi.fn();
    // Filter response: a=YES, b=MAYBE, c=NO
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdicts: [
          { paperIndex: 1, verdict: 'YES' },
          { paperIndex: 2, verdict: 'MAYBE' },
          { paperIndex: 3, verdict: 'NO' },
        ],
      }),
    });
    // Scoring response for survivors (a, b)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scores: [
          { paperIndex: 1, score: 9.1, justification: 'j a' },
          { paperIndex: 2, score: 7.5, justification: 'j b' },
        ],
      }),
    });
    // Synthesis response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        briefing: {
          executiveSummary: 'preview briefing',
          themes: [],
          papers: [],
          debates: [],
          longitudinal: [],
          proactiveQuestions: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));

    await waitFor(() => {
      expect(screen.getByText(/preview complete/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/quick-filter');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/score-abstracts');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/synthesize');
  });

  it('passes editedProfile as scoringCriteria to filter and scoring stages', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ verdicts: [] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scores: [] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        briefing: {
          executiveSummary: '',
          themes: [],
          papers: [],
          debates: [],
          longitudinal: [],
          proactiveQuestions: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const filterBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(filterBody.scoringCriteria).toBe('edited profile text');
  });

  it('shows an error state when filter stage fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));

    await waitFor(() => {
      expect(screen.getByText(/filter stage failed/i)).toBeInTheDocument();
    });
  });

  it('provides a Retry button in the error state', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});

describe('computeRankShifts', () => {
  it('returns empty array when reScored is empty', () => {
    const sample = [{ arxivId: 'a', score: 9 }];
    expect(computeRankShifts(sample, [])).toEqual([]);
  });

  it('computes positive delta when paper rises in ranking', () => {
    // Original rank: a=1, b=2, c=3
    // After rescoring: c=1, a=2, b=3 → c rose from 3 to 1 (delta=+2)
    const sample = [
      { arxivId: 'a', score: 9 },
      { arxivId: 'b', score: 8 },
      { arxivId: 'c', score: 7 },
    ];
    const reScored = [
      { arxivId: 'c', score: 7, newScore: 9.5, title: 'C' },
      { arxivId: 'a', score: 9, newScore: 8.5, title: 'A' },
      { arxivId: 'b', score: 8, newScore: 7.0, title: 'B' },
    ];
    const shifts = computeRankShifts(sample, reScored);
    expect(shifts[0]).toMatchObject({ arxivId: 'c', rankBefore: 3, rankAfter: 1, delta: 2 });
    expect(shifts[1]).toMatchObject({ arxivId: 'a', rankBefore: 1, rankAfter: 2, delta: -1 });
    expect(shifts[2]).toMatchObject({ arxivId: 'b', rankBefore: 2, rankAfter: 3, delta: -1 });
  });

  it('preserves zero delta when ranking is unchanged', () => {
    const sample = [
      { arxivId: 'a', score: 9 },
      { arxivId: 'b', score: 8 },
    ];
    const reScored = [
      { arxivId: 'a', score: 9, newScore: 9.5, title: 'A' },
      { arxivId: 'b', score: 8, newScore: 8.0, title: 'B' },
    ];
    const shifts = computeRankShifts(sample, reScored);
    expect(shifts[0].delta).toBe(0);
    expect(shifts[1].delta).toBe(0);
  });
});

describe('PreviewPanel result rendering', () => {
  const defaultProps = {
    editedProfile: 'edited profile text',
    models: {
      filter: 'gemini-2.5-flash-lite',
      scoring: 'gemini-3-flash',
      briefing: 'gemini-3.1-pro',
    },
    password: 'test-password',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'aparture-last-analysis-run',
      JSON.stringify({
        papers: [
          {
            arxivId: 'a',
            title: 'Alpha paper',
            abstract: 'abs a',
            score: 9,
            fullReport: 'fr a',
            quickSummary: 'qs a',
          },
          {
            arxivId: 'b',
            title: 'Beta paper',
            abstract: 'abs b',
            score: 8,
            fullReport: 'fr b',
            quickSummary: 'qs b',
          },
          {
            arxivId: 'c',
            title: 'Gamma paper',
            abstract: 'abs c',
            score: 6,
            fullReport: 'fr c',
            quickSummary: 'qs c',
          },
        ],
        timestamp: Date.now(),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupFetchMock() {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdicts: [
          { paperIndex: 1, verdict: 'YES' },
          { paperIndex: 2, verdict: 'MAYBE' },
          { paperIndex: 3, verdict: 'NO' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scores: [
          { paperIndex: 1, score: 9.4, justification: 'Highly relevant' },
          { paperIndex: 2, score: 7.6, justification: 'Solid' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        briefing: {
          executiveSummary: 'preview executive summary',
          themes: [
            {
              title: 'A theme',
              argument: 'an argument',
              paperIds: ['a'],
            },
          ],
          papers: [
            {
              arxivId: 'a',
              title: 'Alpha paper',
              score: 9.4,
              onelinePitch: 'pitch',
              whyMatters: 'matters',
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

  it('renders the filter changes section listing dropped papers', async () => {
    vi.stubGlobal('fetch', setupFetchMock());
    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 paper would be filtered out/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Gamma paper')).toBeInTheDocument();
  });

  it('renders the scoring shifts table with the rescored survivors', async () => {
    vi.stubGlobal('fetch', setupFetchMock());
    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));
    await waitFor(() => {
      expect(screen.getByText(/scoring shifts/i)).toBeInTheDocument();
    });
    // Survivors: a (newScore 9.4) and b (newScore 7.6).
    // Note: "Alpha paper" may appear in both the shifts table and the mini briefing
    // PaperCard, so use getAllByText.
    expect(screen.getAllByText('Alpha paper').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Beta paper')).toBeInTheDocument();
    // Old scores rendered in the shifts table as one decimal
    expect(screen.getByText('9.0')).toBeInTheDocument();
    expect(screen.getByText('8.0')).toBeInTheDocument();
    // New scores rendered (7.6 only in our table; 9.4 may also appear in the briefing)
    expect(screen.getAllByText('9.4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('7.6')).toBeInTheDocument();
  });

  it('renders the mini briefing section with PREVIEW banner', async () => {
    vi.stubGlobal('fetch', setupFetchMock());
    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));
    await waitFor(() => {
      expect(screen.getByText(/preview — not saved/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/preview executive summary/i)).toBeInTheDocument();
  });

  it('shows "no papers dropped" copy when filter keeps everything', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verdicts: [
          { paperIndex: 1, verdict: 'YES' },
          { paperIndex: 2, verdict: 'YES' },
          { paperIndex: 3, verdict: 'MAYBE' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        scores: [
          { paperIndex: 1, score: 9, justification: 'a' },
          { paperIndex: 2, score: 8, justification: 'b' },
          { paperIndex: 3, score: 6.5, justification: 'c' },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        briefing: {
          executiveSummary: 'all kept',
          themes: [],
          papers: [],
          debates: [],
          longitudinal: [],
          proactiveQuestions: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<PreviewPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /run preview/i }));
    await waitFor(() => {
      expect(screen.getByText(/0 papers would be filtered out/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/no papers dropped by filter/i)).toBeInTheDocument();
  });
});
