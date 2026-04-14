import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaperCard from '../../components/briefing/PaperCard.jsx';

const paper = {
  arxivId: '2504.01234',
  title: 'Circuit-level analysis of reasoning',
  score: 9.2,
  onelinePitch: 'A mechanistic account of how attention heads compose into reasoning circuits.',
  whyMatters: 'Directly grounded in your stated interest in mechanistic interpretability.',
  figures: [],
};

describe('PaperCard', () => {
  it('renders title, score, pitch, and whyMatters', () => {
    render(<PaperCard paper={paper} />);
    expect(screen.getByText(paper.title)).toBeInTheDocument();
    expect(screen.getByText('9.2')).toBeInTheDocument();
    expect(screen.getByText(paper.onelinePitch)).toBeInTheDocument();
    expect(screen.getByText(paper.whyMatters)).toBeInTheDocument();
  });

  it('applies score-high class to scores >= 9', () => {
    const { container } = render(<PaperCard paper={paper} />);
    const badge = container.querySelector('.score-badge');
    expect(badge).toHaveClass('score-high');
  });

  it('fires onStar when the star action is clicked', async () => {
    const onStar = vi.fn();
    render(<PaperCard paper={paper} onStar={onStar} />);
    await userEvent.click(screen.getByRole('button', { name: /star/i }));
    expect(onStar).toHaveBeenCalledWith(paper.arxivId);
  });

  it('fires onDismiss when the dismiss action is clicked', async () => {
    const onDismiss = vi.fn();
    render(<PaperCard paper={paper} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith(paper.arxivId);
  });
});
