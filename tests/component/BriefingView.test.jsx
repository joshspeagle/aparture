import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingView from '../../components/briefing/BriefingView.jsx';
import sample from '../fixtures/briefing/sample-output.json';

describe('BriefingView', () => {
  it('renders header, executive summary, themes, paper cards, and debates', () => {
    render(
      <BriefingView
        briefing={sample}
        date="April 13, 2026"
        briefingDate="2026-04-13"
        papersScreened={287}
        quickSummariesById={{
          2504.01234: 'Quick summary text for paper 1.',
          2504.02345: 'Quick summary text for paper 2.',
        }}
        fullReportsById={{
          2504.01234: 'Full report 1.',
          2504.02345: 'Full report 2.',
        }}
        feedbackEvents={[]}
        onStar={() => {}}
        onDismiss={() => {}}
        onAddComment={() => {}}
      />
    );
    // Header
    expect(screen.getByText(/DAILY BRIEFING/i)).toBeInTheDocument();
    // Executive summary
    expect(screen.getByText(/three threads pull on the same knot/)).toBeInTheDocument();
    // Theme
    expect(screen.getByText(/Interpretability converges/)).toBeInTheDocument();
    // Paper cards
    expect(screen.getByText('Circuit-level analysis of reasoning')).toBeInTheDocument();
    expect(screen.getByText('Head pruning ablations')).toBeInTheDocument();
    // Debate
    expect(screen.getByText(/DEBATE/i)).toBeInTheDocument();
    expect(screen.getByText(/Are attention heads the right unit/)).toBeInTheDocument();
  });

  it('marks a paper as starred when feedbackEvents contains a star for that arxivId', () => {
    const feedbackEvents = [
      {
        id: 'e1',
        type: 'star',
        arxivId: '2504.01234',
        timestamp: 1,
        briefingDate: '2026-04-10',
      },
    ];
    const { container } = render(
      <BriefingView
        briefing={sample}
        date="April 13, 2026"
        briefingDate="2026-04-13"
        papersScreened={287}
        quickSummariesById={{}}
        fullReportsById={{}}
        feedbackEvents={feedbackEvents}
        onStar={() => {}}
        onDismiss={() => {}}
        onAddComment={() => {}}
      />
    );
    // Exactly one paper card renders its star button in active state.
    const activeStars = container.querySelectorAll('.active-star');
    expect(activeStars.length).toBe(1);
    // And the non-starred paper's dismiss/star should not be active.
    expect(container.querySelectorAll('.active-dismiss').length).toBe(0);
  });

  it('marks a paper as dismissed when feedbackEvents contains a dismiss for that arxivId', () => {
    const feedbackEvents = [
      {
        id: 'e2',
        type: 'dismiss',
        arxivId: '2504.02345',
        timestamp: 2,
        briefingDate: '2026-04-10',
      },
    ];
    const { container } = render(
      <BriefingView
        briefing={sample}
        date="April 13, 2026"
        briefingDate="2026-04-13"
        papersScreened={287}
        quickSummariesById={{}}
        fullReportsById={{}}
        feedbackEvents={feedbackEvents}
        onStar={() => {}}
        onDismiss={() => {}}
        onAddComment={() => {}}
      />
    );
    expect(container.querySelectorAll('.active-dismiss').length).toBe(1);
    expect(container.querySelectorAll('.active-star').length).toBe(0);
  });
});
