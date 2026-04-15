import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryDropdown from '../../../components/profile/HistoryDropdown.jsx';

describe('HistoryDropdown', () => {
  const sampleRevisions = [
    {
      content: 'v2 content',
      createdAt: 1700000000000,
      source: 'manual',
      lastFeedbackCutoff: 0,
    },
    {
      content: 'v1 content',
      createdAt: 1699900000000,
      source: 'suggested',
      lastFeedbackCutoff: 0,
      rationale: 'Added bullet on mechanistic interpretability',
    },
  ];

  it('starts collapsed with a History trigger button', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
    // Content should not be visible when collapsed
    expect(screen.queryByText('v2 content')).toBeNull();
  });

  it('expands when the trigger is clicked', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    // Look for something only visible when expanded — the Revert buttons
    expect(screen.getAllByRole('button', { name: /revert/i })).toHaveLength(2);
  });

  it('renders source badges for each revision', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText(/manual/i)).toBeInTheDocument();
    expect(screen.getByText(/suggested/i)).toBeInTheDocument();
  });

  it('renders the rationale text when present', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText(/mechanistic interpretability/i)).toBeInTheDocument();
  });

  it('calls onRevert with createdAt when a Revert button is clicked', () => {
    const onRevert = vi.fn();
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={onRevert} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    // Click the first Revert button (should match the first revision)
    fireEvent.click(screen.getAllByRole('button', { name: /revert/i })[0]);
    expect(onRevert).toHaveBeenCalledWith(1700000000000);
  });

  it('shows empty state when revisions is empty', () => {
    render(<HistoryDropdown revisions={[]} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText(/no revisions yet/i)).toBeInTheDocument();
  });
});
