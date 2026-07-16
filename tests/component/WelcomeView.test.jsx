import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WelcomeView from '../../components/welcome/WelcomeView.jsx';
import { BLANK_PROFILE_TEMPLATE } from '../../lib/profile/starterTemplates.js';

const freshProfile = {
  content: BLANK_PROFILE_TEMPLATE,
  updatedAt: 1700000000000,
  lastFeedbackCutoff: 0,
  revisions: [],
};

const editedProfile = {
  ...freshProfile,
  content: 'I study simulation-based inference.',
  revisions: [{ content: BLANK_PROFILE_TEMPLATE, createdAt: 1 }],
};

function checkGlyphFor(label) {
  // The glyph is the aria-hidden sibling span before the label.
  return screen.getByText(label).previousSibling.textContent;
}

describe('WelcomeView', () => {
  it('describes the real run flow in step 3 (dry run → minimal test → start analysis)', () => {
    render(<WelcomeView profile={freshProfile} config={{ selectedCategories: [] }} />);
    expect(screen.getByText('Dry Run Test')).toBeInTheDocument();
    expect(screen.getByText('Minimal API Test')).toBeInTheDocument();
    expect(screen.getByText('Start Analysis')).toBeInTheDocument();
  });

  it('renders all four checklist items unchecked for a fresh install', () => {
    render(
      <WelcomeView
        profile={freshProfile}
        config={{ selectedCategories: [] }}
        testState={{ dryRunCompleted: false, lastMinimalTestTime: null }}
      />
    );
    expect(checkGlyphFor('Write your profile (or pick a starter template)')).toBe('○');
    expect(checkGlyphFor('Choose your arXiv categories in Settings')).toBe('○');
    expect(checkGlyphFor('Run the Dry Run Test (free, mock data)')).toBe('○');
    expect(checkGlyphFor('Run the Minimal API Test (5 papers, ~$1)')).toBe('○');
  });

  it('checks items as their live state completes', () => {
    render(
      <WelcomeView
        profile={editedProfile}
        config={{ selectedCategories: ['cs.LG', 'stat.ML'] }}
        testState={{ dryRunCompleted: true, lastMinimalTestTime: new Date() }}
      />
    );
    expect(checkGlyphFor('Write your profile (or pick a starter template)')).toBe('✓');
    expect(checkGlyphFor('Choose your arXiv categories in Settings')).toBe('✓');
    expect(checkGlyphFor('Run the Dry Run Test (free, mock data)')).toBe('✓');
    expect(checkGlyphFor('Run the Minimal API Test (5 papers, ~$1)')).toBe('✓');
  });

  it('an untouched shipped template does not count as a written profile', () => {
    render(
      <WelcomeView profile={freshProfile} config={{ selectedCategories: [] }} testState={{}} />
    );
    expect(checkGlyphFor('Write your profile (or pick a starter template)')).toBe('○');
  });

  it('links to the first-briefing docs page', () => {
    render(<WelcomeView profile={freshProfile} config={{ selectedCategories: [] }} />);
    const link = screen.getByRole('link', { name: /your first briefing/i });
    expect(link).toHaveAttribute(
      'href',
      'https://joshspeagle.github.io/aparture/using/first-briefing'
    );
    expect(link).toHaveAttribute('target', '_blank');
  });
});
