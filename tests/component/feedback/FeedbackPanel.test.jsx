import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedbackPanel from '../../../components/feedback/FeedbackPanel.jsx';

describe('FeedbackPanel', () => {
  const makeStar = (id, arxivId, timestamp) => ({
    id,
    type: 'star',
    arxivId,
    paperTitle: `Title ${arxivId}`,
    quickSummary: 's',
    score: 9,
    timestamp,
    briefingDate: '2026-04-10',
  });

  const defaultProps = {
    events: [],
    cutoff: 0,
    onAddGeneralComment: vi.fn(),
    onSuggestClick: vi.fn(),
  };

  it('renders the header title', () => {
    render(<FeedbackPanel {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /feedback/i })).toBeInTheDocument();
  });

  it('renders FeedbackEmptyState when events is empty', () => {
    render(<FeedbackPanel {...defaultProps} />);
    expect(screen.getByText(/feedback will appear here/i)).toBeInTheDocument();
  });

  it('renders the timeline instead of the empty state when events exist', () => {
    const events = [makeStar('s1', '2504.01234', 1700000000000)];
    const { container } = render(<FeedbackPanel {...defaultProps} events={events} />);
    expect(screen.queryByText(/feedback will appear here/i)).toBeNull();
    expect(container.querySelector('[data-event-type="star"]')).not.toBeNull();
  });

  it('computes newCount from events after the cutoff', () => {
    const events = [
      makeStar('s1', 'p1', 1000), // older
      makeStar('s2', 'p2', 3000), // newer
      makeStar('s3', 'p3', 4000), // newer
    ];
    render(<FeedbackPanel {...defaultProps} events={events} cutoff={2000} />);
    // Header should say "2 new since last revision · 3 total"
    expect(screen.getByText(/2 new/i)).toBeInTheDocument();
    expect(screen.getByText(/3 total/i)).toBeInTheDocument();
  });

  it('keeps the Suggest improvements button clickable even when newCount is 0', () => {
    // The dialog lets the user drive revisions from guidance alone (no feedback
    // required), so the entry button stays live regardless of newCount.
    const events = [makeStar('s1', 'p1', 1000)];
    render(<FeedbackPanel {...defaultProps} events={events} cutoff={5000} />);
    expect(screen.getByRole('button', { name: /suggest improvements/i })).not.toBeDisabled();
  });

  it('calls onSuggestClick when Suggest improvements is clicked', () => {
    const onSuggestClick = vi.fn();
    const events = [makeStar('s1', 'p1', 1000)];
    render(
      <FeedbackPanel {...defaultProps} events={events} cutoff={0} onSuggestClick={onSuggestClick} />
    );
    fireEvent.click(screen.getByRole('button', { name: /suggest improvements/i }));
    expect(onSuggestClick).toHaveBeenCalledOnce();
  });

  it('renders the GeneralCommentInput add-a-comment trigger', () => {
    render(<FeedbackPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add a comment/i })).toBeInTheDocument();
  });

  it('wires GeneralCommentInput save to onAddGeneralComment with briefingId', () => {
    const onAddGeneralComment = vi.fn();
    render(
      <FeedbackPanel
        {...defaultProps}
        briefingId="briefing-123"
        onAddGeneralComment={onAddGeneralComment}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'general thought' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onAddGeneralComment).toHaveBeenCalledWith('general thought', 'briefing-123');
  });

  it('passes undefined briefingId when prop is omitted', () => {
    const onAddGeneralComment = vi.fn();
    render(<FeedbackPanel {...defaultProps} onAddGeneralComment={onAddGeneralComment} />);
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'general thought' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onAddGeneralComment).toHaveBeenCalledWith('general thought', undefined);
  });
});
