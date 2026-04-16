import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeedbackItem from '../../../components/feedback/FeedbackItem.jsx';

describe('FeedbackItem', () => {
  const baseStar = {
    id: 's1',
    type: 'star',
    arxivId: '2504.01234',
    paperTitle: 'Circuit analysis',
    quickSummary: 'summary',
    score: 9.2,
    timestamp: 1700000000000,
    briefingDate: '2026-04-10',
  };

  it('renders a star event with yellow border and ★ icon', () => {
    const { container } = render(<FeedbackItem event={baseStar} />);
    const item = container.querySelector('[data-event-type="star"]');
    expect(item).not.toBeNull();
    expect(screen.getByText(/★/)).toBeInTheDocument();
    expect(screen.getByText(/Circuit analysis/)).toBeInTheDocument();
    expect(screen.getByText(/2504\.01234/)).toBeInTheDocument();
  });

  it('renders a dismiss event with gray border and ⊘ icon', () => {
    const dismiss = { ...baseStar, id: 'd1', type: 'dismiss' };
    const { container } = render(<FeedbackItem event={dismiss} />);
    expect(container.querySelector('[data-event-type="dismiss"]')).not.toBeNull();
    expect(screen.getByText(/⊘/)).toBeInTheDocument();
  });

  it('renders a paper-comment with purple border, 💬 icon, and italic quoted text', () => {
    const comment = {
      ...baseStar,
      id: 'c1',
      type: 'paper-comment',
      text: 'This is exactly the angle I wanted',
    };
    const { container } = render(<FeedbackItem event={comment} />);
    expect(container.querySelector('[data-event-type="paper-comment"]')).not.toBeNull();
    expect(screen.getByText(/💬/)).toBeInTheDocument();
    expect(screen.getByText(/exactly the angle/)).toBeInTheDocument();
    expect(screen.getByText(/Circuit analysis/)).toBeInTheDocument();
  });

  it('renders a general-comment with blue border, 💭 icon, and text only (no paper ref)', () => {
    const general = {
      id: 'g1',
      type: 'general-comment',
      text: 'too much theory this week',
      timestamp: 1700000000000,
      briefingDate: '2026-04-14',
    };
    const { container } = render(<FeedbackItem event={general} />);
    expect(container.querySelector('[data-event-type="general-comment"]')).not.toBeNull();
    expect(screen.getByText(/💭/)).toBeInTheDocument();
    expect(screen.getByText(/too much theory/)).toBeInTheDocument();
  });

  it('includes an aria-label describing the event type and paper', () => {
    const { container } = render(<FeedbackItem event={baseStar} />);
    const labelled = container.querySelector('[aria-label*="star"]');
    expect(labelled).not.toBeNull();
    expect(labelled.getAttribute('aria-label')).toMatch(/Circuit analysis|2504\.01234/);
  });

  it('shows the briefing date in the metadata line', () => {
    render(<FeedbackItem event={baseStar} />);
    expect(screen.getByText(/2026-04-10/)).toBeInTheDocument();
  });
});
