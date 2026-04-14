import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LongitudinalBlock from '../../components/briefing/LongitudinalBlock.jsx';

describe('LongitudinalBlock', () => {
  it('renders the longitudinal label and connection summary', () => {
    render(
      <LongitudinalBlock
        summary="This is a direct follow-up to the March 3 paper on circuit sparsity."
        todayPaperId="2504.01234"
        pastPaperId="2503.55555"
        pastDate="2026-03-03"
      />
    );
    expect(screen.getByText(/LONGITUDINAL/i)).toBeInTheDocument();
    expect(screen.getByText(/direct follow-up to the March 3/)).toBeInTheDocument();
  });
});
