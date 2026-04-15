import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestDialog from '../../../components/profile/SuggestDialog.jsx';

describe('SuggestDialog — selection state', () => {
  const starEvent = {
    id: 'e1',
    type: 'star',
    arxivId: '2504.01234',
    paperTitle: 'Circuit analysis',
    quickSummary: 'summary',
    score: 9.2,
    timestamp: 1700000000000,
    briefingDate: '2026-04-10',
  };
  const dismissEvent = {
    id: 'e2',
    type: 'dismiss',
    arxivId: '2504.02345',
    paperTitle: 'Head pruning',
    quickSummary: 'summary',
    score: 6,
    timestamp: 1700000000001,
    briefingDate: '2026-04-10',
  };
  const generalEvent = {
    id: 'e3',
    type: 'general-comment',
    text: 'too much theory',
    timestamp: 1700000000002,
    briefingDate: '2026-04-11',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    profile: 'current profile',
    newFeedback: [starEvent, dismissEvent, generalEvent],
    cap: { commentCap: 30 },
    briefingModel: 'gemini-3.1-pro',
    provider: 'google',
    password: 'test',
    onAccept: vi.fn(),
  };

  it('renders the dialog header when open', () => {
    render(<SuggestDialog {...defaultProps} />);
    expect(screen.getByText(/suggest profile improvements/i)).toBeInTheDocument();
  });

  it('renders nothing when isOpen is false', () => {
    render(<SuggestDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/suggest profile improvements/i)).toBeNull();
  });

  it('renders one checkbox per feedback event', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('starts with all checkboxes checked', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  it('allows unchecking individual events', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it('disables Generate when all items are unchecked', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));
    expect(screen.getByRole('button', { name: /generate suggestion/i })).toBeDisabled();
  });

  it('shows empty state when newFeedback is empty', () => {
    render(<SuggestDialog {...defaultProps} newFeedback={[]} />);
    expect(screen.getByText(/no new feedback/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate suggestion/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SuggestDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows cap notice when cap trims items', () => {
    // Create 40 paper-comments so cap (30) will trim 10
    const manyComments = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      type: 'paper-comment',
      arxivId: `pc${i}`,
      paperTitle: `T${i}`,
      quickSummary: 's',
      score: 5,
      text: `comment ${i}`,
      timestamp: 1700000000000 + i,
      briefingDate: '2026-04-10',
    }));
    render(<SuggestDialog {...defaultProps} newFeedback={manyComments} />);
    expect(screen.getByText(/older comments will not be included/i)).toBeInTheDocument();
  });

  it('does not show cap notice when nothing would be trimmed', () => {
    render(<SuggestDialog {...defaultProps} />);
    expect(screen.queryByText(/older comments will not be included/i)).toBeNull();
  });
});
