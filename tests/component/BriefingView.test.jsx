import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingView, { layoutBriefing } from '../../components/briefing/BriefingView.jsx';
import sample from '../fixtures/briefing/sample-output.json';

const card = (arxivId, title) => ({
  arxivId,
  title,
  score: 7,
  onelinePitch: `Pitch ${arxivId}`,
  whyMatters: `Why ${arxivId}`,
});

const renderView = (briefing) =>
  render(
    <BriefingView
      briefing={briefing}
      date="April 13, 2026"
      briefingDate="2026-04-13"
      papersScreened={10}
      feedbackEvents={[]}
      onStar={() => {}}
      onDismiss={() => {}}
      onAddComment={() => {}}
    />
  );

describe('BriefingView — every paper renders exactly once', () => {
  const briefing = {
    executiveSummary: 'Lede.',
    themes: [
      { title: 'Theme A', argument: 'Arg A', paperIds: ['p1', 'p2'] },
      // p2 again: used to render a second card.
      { title: 'Theme B', argument: 'Arg B', paperIds: ['p2', 'p3', 'ghost'] },
    ],
    // p4 is in no theme: it used to vanish (while still counted in focus).
    papers: [
      card('p1', 'Paper One'),
      card('p2', 'Paper Two'),
      card('p3', 'Paper Three'),
      card('p4', 'Paper Four'),
    ],
  };

  it('renders a paper listed in two themes once, and an unthemed card under "Other papers"', () => {
    const { container } = renderView(briefing);
    expect(container.querySelectorAll('.paper-card')).toHaveLength(4);
    expect(screen.getAllByText('Paper Two', { selector: '.paper-title' })).toHaveLength(1);
    expect(screen.getByText('Paper Four', { selector: '.paper-title' })).toBeInTheDocument();
    expect(screen.getByText('Other papers')).toBeInTheDocument();
    // Theme B still notes its link to the paper shown above.
    expect(screen.getByText(/Also in this theme \(shown above\): Paper Two/)).toBeInTheDocument();
  });

  it('lays cards out deterministically: first theme wins, orphans last, ghost ids ignored', () => {
    const layout = layoutBriefing(briefing);
    expect(layout.themes.map((t) => t.ids)).toEqual([['p1', 'p2'], ['p3']]);
    expect(layout.themes[1].alsoAbove).toEqual(['p2']);
    expect(layout.orphanIds).toEqual(['p4']);
  });

  it('counts unique papers in focus, ignoring a duplicate card', () => {
    const layout = layoutBriefing({
      ...briefing,
      papers: [...briefing.papers, card('p1', 'Paper One (dup)')],
    });
    expect(layout.papers).toHaveLength(4);
    expect(layout.papersById.p1.title).toBe('Paper One');
  });

  it('renders no "Other papers" group when every card is themed', () => {
    renderView(sample);
    expect(screen.queryByText('Other papers')).toBeNull();
  });
});

describe('BriefingView', () => {
  it('renders header, executive summary, themes, and paper cards', () => {
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
