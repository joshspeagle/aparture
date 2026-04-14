import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThemeSection from '../../components/briefing/ThemeSection.jsx';

describe('ThemeSection', () => {
  it('renders the theme label, title, argument, and child papers', () => {
    render(
      <ThemeSection
        index={1}
        title="Interpretability converges on attention heads"
        argument="Both papers analyze circuits at the attention-head level."
      >
        <div data-testid="child-paper">Paper 1</div>
      </ThemeSection>
    );
    expect(screen.getByText(/THEME 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Interpretability converges/)).toBeInTheDocument();
    expect(screen.getByText(/Both papers analyze circuits/)).toBeInTheDocument();
    expect(screen.getByTestId('child-paper')).toBeInTheDocument();
  });
});
