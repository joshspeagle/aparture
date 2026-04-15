import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MigrationNotice from '../../../components/profile/MigrationNotice.jsx';

describe('MigrationNotice', () => {
  const sampleNotice = {
    type: 'phase1-conflict',
    discardedContent: 'Old scoring criteria text that was replaced',
  };

  it('renders nothing when notice is null', () => {
    const { container } = render(<MigrationNotice notice={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner text when notice is provided', () => {
    render(<MigrationNotice notice={sampleNotice} onDismiss={() => {}} />);
    expect(screen.getByText(/previous Scoring Criteria was different/i)).toBeInTheDocument();
  });

  it('shows a View discarded content button and a Dismiss button', () => {
    render(<MigrationNotice notice={sampleNotice} onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: /view discarded/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('calls onDismiss when Dismiss is clicked', () => {
    const onDismiss = vi.fn();
    render(<MigrationNotice notice={sampleNotice} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('opens a dialog showing discarded content when View is clicked', () => {
    render(<MigrationNotice notice={sampleNotice} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /view discarded/i }));
    // Radix Dialog renders content via a portal; query document.body directly
    expect(screen.getByText(/Old scoring criteria text that was replaced/)).toBeInTheDocument();
  });
});
