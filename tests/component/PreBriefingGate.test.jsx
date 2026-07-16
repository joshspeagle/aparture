import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PreBriefingGate from '../../components/shell/PreBriefingGate.jsx';

const mkPaper = (id) => ({ id, arxivId: id, title: `Paper ${id}` });
const renderPaperCard = (p) => <div data-testid={`paper-${p.id}`}>{p.title}</div>;

const base = {
  renderPaperCard,
  onContinueAfterReview: () => {},
  onSkipRemainingGates: () => {},
  onAddGeneralComment: () => {},
};

describe('PreBriefingGate', () => {
  it('renders the continue banner', () => {
    render(<PreBriefingGate {...base} results={{ allAnalyzedPapers: [], finalRanking: [] }} />);
    expect(screen.getByRole('button', { name: /Continue to briefing/ })).toBeInTheDocument();
  });

  it('Continue fires the handler', () => {
    const onContinue = vi.fn();
    render(
      <PreBriefingGate
        {...base}
        onContinueAfterReview={onContinue}
        results={{ allAnalyzedPapers: [], finalRanking: [] }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue to briefing/ }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('Skip fires onSkipRemainingGates', () => {
    const onSkip = vi.fn();
    render(
      <PreBriefingGate
        {...base}
        onSkipRemainingGates={onSkip}
        results={{ allAnalyzedPapers: [], finalRanking: [] }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Skip remaining gates/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('shows the expander only when there are cut papers', () => {
    const { rerender } = render(
      <PreBriefingGate
        {...base}
        results={{ allAnalyzedPapers: [mkPaper('a')], finalRanking: [mkPaper('a')] }}
      />
    );
    expect(screen.queryByText(/more PDF-analyzed papers/)).not.toBeInTheDocument();
    rerender(
      <PreBriefingGate
        {...base}
        results={{ allAnalyzedPapers: [mkPaper('a'), mkPaper('b')], finalRanking: [mkPaper('a')] }}
      />
    );
    expect(screen.getByText(/more PDF-analyzed papers/)).toBeInTheDocument();
  });

  it('renders the reviewed content passed as children (the banner heads it)', () => {
    render(
      <PreBriefingGate {...base} results={{ allAnalyzedPapers: [], finalRanking: [] }}>
        <div data-testid="reviewed-content">analysis list</div>
      </PreBriefingGate>
    );
    // The banner's Continue control and the reviewed content both render; the
    // banner sits above the content (banner-at-head, matching gates 1 & 2).
    expect(screen.getByRole('button', { name: /Continue to briefing/ })).toBeInTheDocument();
    expect(screen.getByTestId('reviewed-content')).toBeInTheDocument();
  });
});

describe('PreBriefingGate — projected briefing spend', () => {
  const pricedConfig = {
    briefingModel: 'claude-haiku-4.5',
    quickSummaryModel: 'claude-haiku-4.5',
  };

  it('shows the briefing estimate when the models have registry pricing', () => {
    render(
      <PreBriefingGate
        {...base}
        config={pricedConfig}
        results={{ allAnalyzedPapers: [], finalRanking: [mkPaper('a'), mkPaper('b')] }}
      />
    );
    expect(screen.getByText(/Briefing over 2 papers — est\. \$\d+\.\d{2}/)).toBeInTheDocument();
  });

  it('hides the estimate when any involved model has no registry pricing', () => {
    render(
      <PreBriefingGate
        {...base}
        config={{ briefingModel: 'claude-haiku-4.5', quickSummaryModel: 'mystery-model' }}
        results={{ allAnalyzedPapers: [], finalRanking: [mkPaper('a')] }}
      />
    );
    expect(screen.queryByText(/Briefing over/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$null/)).not.toBeInTheDocument();
  });

  it('hides the estimate when there is no config or no papers', () => {
    const { rerender } = render(
      <PreBriefingGate
        {...base}
        results={{ allAnalyzedPapers: [], finalRanking: [mkPaper('a')] }}
      />
    );
    expect(screen.queryByText(/Briefing over/)).not.toBeInTheDocument();
    rerender(
      <PreBriefingGate
        {...base}
        config={pricedConfig}
        results={{ allAnalyzedPapers: [], finalRanking: [] }}
      />
    );
    expect(screen.queryByText(/Briefing over/)).not.toBeInTheDocument();
  });
});
