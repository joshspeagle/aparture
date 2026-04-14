import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingView from '../../components/briefing/BriefingView.jsx';
import sample from '../fixtures/briefing/sample-output.json';

describe('BriefingView', () => {
  it('renders header, executive summary, themes, paper cards, debates, and proactive questions', () => {
    render(
      <BriefingView
        briefing={sample}
        date="April 13, 2026"
        papersScreened={287}
        quickSummariesById={{
          2504.01234: 'Quick summary text for paper 1.',
          2504.02345: 'Quick summary text for paper 2.',
        }}
        fullReportsById={{
          2504.01234: 'Full report 1.',
          2504.02345: 'Full report 2.',
        }}
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
    // Proactive question
    expect(screen.getByText(/starred 3 papers on normalizing flows/)).toBeInTheDocument();
  });
});
