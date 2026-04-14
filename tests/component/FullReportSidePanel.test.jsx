import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullReportSidePanel from '../../components/briefing/FullReportSidePanel.jsx';

describe('FullReportSidePanel', () => {
  it('shows the full report content when open', () => {
    render(
      <FullReportSidePanel
        open
        onOpenChange={() => {}}
        title="Circuit-level analysis of reasoning"
        content="Full ~1200-word technical report text."
      />
    );
    expect(screen.getByText(/Full ~1200-word technical report text/)).toBeInTheDocument();
  });

  it('calls onOpenChange when the close button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(<FullReportSidePanel open onOpenChange={onOpenChange} title="t" content="c" />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
