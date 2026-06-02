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
});
