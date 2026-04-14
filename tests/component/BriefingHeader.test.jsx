import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingHeader from '../../components/briefing/BriefingHeader.jsx';

describe('BriefingHeader', () => {
  it('renders date, tagline, and stats line', () => {
    render(
      <BriefingHeader
        date="April 13, 2026"
        papersInFocus={5}
        papersScreened={287}
        readingTimeMinutes={14}
      />
    );
    expect(screen.getByText(/DAILY BRIEFING/i)).toBeInTheDocument();
    expect(screen.getByText(/April 13, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Bringing the arXiv into focus/i)).toBeInTheDocument();
    expect(screen.getByText(/5 papers in focus/)).toBeInTheDocument();
    expect(screen.getByText(/287 screened/)).toBeInTheDocument();
    expect(screen.getByText(/~14 min/)).toBeInTheDocument();
  });
});
