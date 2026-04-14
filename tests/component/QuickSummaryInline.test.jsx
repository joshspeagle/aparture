import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuickSummaryInline from '../../components/briefing/QuickSummaryInline.jsx';

describe('QuickSummaryInline', () => {
  it('shows the quick summary text when open', () => {
    render(<QuickSummaryInline open text="A compressed 300-word quick summary of the paper." />);
    expect(screen.getByText(/A compressed 300-word quick summary/)).toBeInTheDocument();
  });

  it('hides the content when not open', () => {
    render(<QuickSummaryInline open={false} text="Hidden summary." />);
    expect(screen.queryByText(/Hidden summary/)).not.toBeInTheDocument();
  });
});
