import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScoreReviewSurface from '../../../components/score-review/ScoreReviewSurface.jsx';

const mkPaper = (id, score) => ({
  id,
  arxivId: id,
  title: `Paper ${id}`,
  relevanceScore: score,
  filterSummary: `summary ${id}`,
  scoreJustification: `justification ${id}`,
});

describe('ScoreReviewSurface', () => {
  it('renders the "New:" subhead', () => {
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={() => {}}
      />
    );
    expect(screen.getByText(/New:/)).toBeInTheDocument();
  });

  it('renders the title with paper count', () => {
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8), mkPaper('b', 7)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={() => {}}
      />
    );
    expect(screen.getByText(/Score review.*2 papers/i)).toBeInTheDocument();
  });

  it('renders top-N group expanded by default with paper title', () => {
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8), mkPaper('b', 7), mkPaper('c', 6)]}
        maxDeepAnalysis={2}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={() => {}}
      />
    );
    expect(screen.getByText('Paper a')).toBeInTheDocument();
    expect(screen.getByText('Paper b')).toBeInTheDocument();
    // Borderline (Paper c) collapsed by default
    expect(screen.queryByText('Paper c')).not.toBeInTheDocument();
  });

  it('Continue button calls onContinue', () => {
    const onContinue = vi.fn();
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={onContinue}
      />
    );
    fireEvent.click(screen.getByText(/Continue to PDF analysis/));
    expect(onContinue).toHaveBeenCalled();
  });

  it('star click on a top-N row calls onStar with the paper id', () => {
    const onStar = vi.fn();
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={onStar}
        onDismiss={() => {}}
        onContinue={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('ms-star-a'));
    expect(onStar).toHaveBeenCalledWith('a');
  });

  it('dismiss click calls onDismiss with paper id', () => {
    const onDismiss = vi.fn();
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={onDismiss}
        onContinue={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('ms-dismiss-a'));
    expect(onDismiss).toHaveBeenCalledWith('a');
  });

  it('renders skip-remaining-gates link when handler provided', () => {
    const onSkipRemaining = vi.fn();
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={() => {}}
        onSkipRemaining={onSkipRemaining}
      />
    );
    const link = screen.getByText(/Skip remaining gates this run/i);
    expect(link).toBeInTheDocument();
    fireEvent.click(link);
    expect(onSkipRemaining).toHaveBeenCalled();
  });

  it('expanding borderline group reveals its rows', () => {
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8), mkPaper('b', 7), mkPaper('c', 6)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={() => {}}
      />
    );
    // Paper b is borderline (slice(1, 1+min(1,50))=slice(1,2)), collapsed by default
    expect(screen.queryByText('Paper b')).not.toBeInTheDocument();
    const borderlineToggle = screen.getByText(/Borderline/);
    fireEvent.click(borderlineToggle);
    expect(screen.getByText('Paper b')).toBeInTheDocument();
  });

  it('💬 add comment button appears on each top-N row when onAddPaperComment provided', () => {
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={() => {}}
        onAddPaperComment={() => {}}
      />
    );
    expect(screen.getByText(/add comment/i)).toBeInTheDocument();
  });

  it('saving a row comment fires onAddPaperComment with arxivId + text', () => {
    const onAddPaperComment = vi.fn();
    render(
      <ScoreReviewSurface
        availablePapers={[mkPaper('a', 8)]}
        maxDeepAnalysis={1}
        starredIds={new Set()}
        dismissedIds={new Set()}
        onStar={() => {}}
        onDismiss={() => {}}
        onContinue={() => {}}
        onAddPaperComment={onAddPaperComment}
      />
    );
    fireEvent.click(screen.getByText(/add comment/i));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'borderline pick' } });
    fireEvent.click(screen.getByText(/^save$/i));
    expect(onAddPaperComment).toHaveBeenCalledWith(
      expect.objectContaining({ arxivId: 'a', text: 'borderline pick' })
    );
  });
});
