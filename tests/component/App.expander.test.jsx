import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalyzedExpander from '../../components/shell/AnalyzedExpander.jsx';

const mkPaper = (id) => ({ id, arxivId: id, title: `Paper ${id}`, relevanceScore: 8 });

// A minimal renderPaperCard that renders a <div data-testid="paper-{id}"> so we can
// assert the card is present without pulling in the full PaperCard tree.
const renderPaperCard = (paper) => (
  <div key={paper.id ?? paper.arxivId} data-testid={`paper-${paper.id ?? paper.arxivId}`}>
    {paper.title}
  </div>
);

describe('Pre-briefing analyzed-but-cut expander', () => {
  it('renders "+ Show N more PDF-analyzed papers" link when allAnalyzedPapers > finalRanking', () => {
    const allAnalyzedPapers = [mkPaper('a'), mkPaper('b'), mkPaper('c')];
    const finalRanking = [mkPaper('a')];
    render(
      <AnalyzedExpander
        allAnalyzedPapers={allAnalyzedPapers}
        finalRanking={finalRanking}
        renderPaperCard={renderPaperCard}
      />
    );
    // 3 analyzed − 1 in top = 2 cut
    expect(screen.getByText(/\+ Show 2 more PDF-analyzed papers/)).toBeInTheDocument();
  });

  it('clicking the expander reveals muted PaperCards for cut papers', () => {
    const allAnalyzedPapers = [mkPaper('a'), mkPaper('b'), mkPaper('c')];
    const finalRanking = [mkPaper('a')];
    render(
      <AnalyzedExpander
        allAnalyzedPapers={allAnalyzedPapers}
        finalRanking={finalRanking}
        renderPaperCard={renderPaperCard}
      />
    );
    const summary = screen.getByText(/\+ Show 2 more PDF-analyzed papers/);
    fireEvent.click(summary);
    // Papers 'b' and 'c' are cut; 'a' is in finalRanking and should NOT appear
    expect(screen.getByTestId('paper-b')).toBeInTheDocument();
    expect(screen.getByTestId('paper-c')).toBeInTheDocument();
    expect(screen.queryByTestId('paper-a')).not.toBeInTheDocument();
  });

  it('★ on a cut paper calls the onPromotePaper handler with the paper object', () => {
    const allAnalyzedPapers = [mkPaper('a'), mkPaper('b')];
    const finalRanking = [mkPaper('a')];
    const onPromotePaper = vi.fn();
    render(
      <AnalyzedExpander
        allAnalyzedPapers={allAnalyzedPapers}
        finalRanking={finalRanking}
        renderPaperCard={renderPaperCard}
        onPromotePaper={onPromotePaper}
      />
    );
    fireEvent.click(screen.getByText(/\+ Show 1 more PDF-analyzed papers/));
    fireEvent.click(screen.getByText(/★ promote to briefing/));
    expect(onPromotePaper).toHaveBeenCalledOnce();
    expect(onPromotePaper).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });
});
