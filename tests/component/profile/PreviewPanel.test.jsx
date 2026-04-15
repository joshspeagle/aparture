import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PreviewPanel, { selectPreviewSample } from '../../../components/profile/PreviewPanel.jsx';

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
