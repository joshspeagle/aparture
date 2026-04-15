import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PaperCard from '../../components/briefing/PaperCard.jsx';

describe('PaperCard', () => {
  const basePaper = {
    arxivId: '2504.01234',
    title: 'Circuit-level analysis of reasoning',
    score: 9.2,
    onelinePitch: 'A mechanistic account of attention-head composition.',
    whyMatters: 'Directly grounded in your stated interest in mech interp.',
    quickSummary: 'quick summary text',
  };

  const defaultProps = {
    paper: basePaper,
    briefingDate: '2026-04-14',
    onStar: vi.fn(),
    onDismiss: vi.fn(),
    onAddComment: vi.fn(),
    onOpenQuickSummary: vi.fn(),
    onOpenFullReport: vi.fn(),
  };

  it('renders the paper title, score, and arxivId', () => {
    render(<PaperCard {...defaultProps} />);
    expect(screen.getByText(/circuit-level analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/9\.2/)).toBeInTheDocument();
    expect(screen.getByText(/2504\.01234/)).toBeInTheDocument();
  });

  it('renders ☆ outline when starred is false', () => {
    render(<PaperCard {...defaultProps} starred={false} />);
    const starButton = screen.getByRole('button', { name: /star/i });
    expect(starButton.textContent).toMatch(/☆/);
    expect(starButton).not.toHaveClass('active-star');
    expect(starButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders ★ filled when starred is true', () => {
    render(<PaperCard {...defaultProps} starred={true} />);
    const starButton = screen.getByRole('button', { name: /star/i });
    expect(starButton.textContent).toMatch(/★/);
    expect(starButton).toHaveClass('active-star');
    expect(starButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies active-dismiss class when dismissed is true', () => {
    render(<PaperCard {...defaultProps} dismissed={true} />);
    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissButton).toHaveClass('active-dismiss');
    expect(dismissButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onStar with full paper metadata when star clicked', () => {
    const onStar = vi.fn();
    render(<PaperCard {...defaultProps} onStar={onStar} />);
    fireEvent.click(screen.getByRole('button', { name: /star/i }));
    expect(onStar).toHaveBeenCalledWith({
      arxivId: '2504.01234',
      paperTitle: 'Circuit-level analysis of reasoning',
      quickSummary: 'quick summary text',
      score: 9.2,
      briefingDate: '2026-04-14',
    });
  });

  it('calls onDismiss with full paper metadata when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(<PaperCard {...defaultProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith(
      expect.objectContaining({
        arxivId: '2504.01234',
        paperTitle: 'Circuit-level analysis of reasoning',
      })
    );
  });

  it('does not render the comment textarea initially', () => {
    render(<PaperCard {...defaultProps} />);
    expect(screen.queryByPlaceholderText(/your thoughts/i)).toBeNull();
  });

  it('expands a textarea when + comment is clicked', () => {
    render(<PaperCard {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add comment/i }));
    expect(screen.getByPlaceholderText(/your thoughts/i)).toBeInTheDocument();
  });

  it('calls onAddComment with arxivId and text when Save is clicked', () => {
    const onAddComment = vi.fn();
    render(<PaperCard {...defaultProps} onAddComment={onAddComment} />);
    fireEvent.click(screen.getByRole('button', { name: /add comment/i }));
    fireEvent.change(screen.getByPlaceholderText(/your thoughts/i), {
      target: { value: 'great paper' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onAddComment).toHaveBeenCalledWith('2504.01234', 'great paper');
  });

  it('collapses the textarea without calling onAddComment when Cancel is clicked', () => {
    const onAddComment = vi.fn();
    render(<PaperCard {...defaultProps} onAddComment={onAddComment} />);
    fireEvent.click(screen.getByRole('button', { name: /add comment/i }));
    fireEvent.change(screen.getByPlaceholderText(/your thoughts/i), {
      target: { value: 'partial' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onAddComment).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/your thoughts/i)).toBeNull();
  });

  it('disables Save when the comment is empty or whitespace only', () => {
    render(<PaperCard {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add comment/i }));
    const save = screen.getByRole('button', { name: /^save$/i });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/your thoughts/i), { target: { value: '   ' } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/your thoughts/i), {
      target: { value: 'real text' },
    });
    expect(save).not.toBeDisabled();
  });
});
