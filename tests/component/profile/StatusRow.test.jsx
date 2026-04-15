import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusRow from '../../../components/profile/StatusRow.jsx';

describe('StatusRow', () => {
  it('renders the count and date', () => {
    render(<StatusRow newInteractionCount={12} lastUpdated={Date.now()} />);
    expect(screen.getByText(/12 new interactions/i)).toBeInTheDocument();
    expect(screen.getByText(/Updated/i)).toBeInTheDocument();
  });

  it('shows "No new feedback" when count is 0', () => {
    render(<StatusRow newInteractionCount={0} lastUpdated={Date.now()} />);
    expect(screen.getByText(/No new feedback/i)).toBeInTheDocument();
  });

  it('calls onScrollToFeedback when count clicked', () => {
    const onScroll = vi.fn();
    render(
      <StatusRow newInteractionCount={5} lastUpdated={Date.now()} onScrollToFeedback={onScroll} />
    );
    fireEvent.click(screen.getByRole('button', { name: /5 new/i }));
    expect(onScroll).toHaveBeenCalledOnce();
  });

  it('does not render a button when count is 0', () => {
    render(<StatusRow newInteractionCount={0} lastUpdated={Date.now()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows "never" when lastUpdated is falsy', () => {
    render(<StatusRow newInteractionCount={0} lastUpdated={0} />);
    expect(screen.getByText(/never/i)).toBeInTheDocument();
  });
});
