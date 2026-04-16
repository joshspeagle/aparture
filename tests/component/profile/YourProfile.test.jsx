import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import YourProfile from '../../../components/profile/YourProfile.jsx';

// Wrapper that provides the draft/setDraft state pair that App.jsx normally owns.
function Harness({ initialDraft, ...props }) {
  const [draftContent, setDraftContent] = useState(initialDraft ?? props.profile?.content ?? '');
  return <YourProfile {...props} draftContent={draftContent} setDraftContent={setDraftContent} />;
}

describe('YourProfile', () => {
  const defaultProps = {
    profile: {
      content: 'I study mechanistic interpretability.',
      updatedAt: 1700000000000,
      lastFeedbackCutoff: 0,
      revisions: [],
    },
    updateProfile: vi.fn(),
    migrationNotice: null,
    dismissMigrationNotice: vi.fn(),
    revertToRevision: vi.fn(),
    clearHistory: vi.fn(),
    newFeedback: [
      { id: '1', type: 'star', arxivId: '2504.01234' },
      { id: '2', type: 'dismiss', arxivId: '2504.05678' },
      { id: '3', type: 'paper-comment', arxivId: '2504.01234', text: 'good' },
    ],
    onSuggestClick: vi.fn(),
  };

  it('renders the panel title', () => {
    render(<Harness {...defaultProps} />);
    expect(screen.getByText('Your Profile')).toBeInTheDocument();
  });

  it('renders a textarea initially bound to profile.content', () => {
    render(<Harness {...defaultProps} />);
    expect(screen.getByRole('textbox')).toHaveValue('I study mechanistic interpretability.');
  });

  it('typing updates the draft but does NOT call updateProfile', () => {
    const updateProfile = vi.fn();
    render(<Harness {...defaultProps} updateProfile={updateProfile} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new draft content' } });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('new draft content');
  });

  it('shows the Unsaved changes indicator when the draft differs from profile.content', () => {
    render(<Harness {...defaultProps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'different content' } });
    expect(screen.getByLabelText('unsaved changes')).toBeInTheDocument();
  });

  it('does not show the Unsaved indicator when the draft equals profile.content', () => {
    render(<Harness {...defaultProps} />);
    expect(screen.queryByLabelText('unsaved changes')).toBeNull();
  });

  it('Save button is disabled when there are no unsaved changes', () => {
    render(<Harness {...defaultProps} />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('Save button calls updateProfile with the draft content when clicked', () => {
    const updateProfile = vi.fn();
    render(<Harness {...defaultProps} updateProfile={updateProfile} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new draft content' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(updateProfile).toHaveBeenCalledWith('new draft content');
  });

  it('Discard button reverts the draft to profile.content without calling updateProfile', () => {
    const updateProfile = vi.fn();
    render(<Harness {...defaultProps} updateProfile={updateProfile} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'throwaway draft' } });
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(updateProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('I study mechanistic interpretability.');
  });

  it('Suggest improvements is disabled when the draft is dirty', () => {
    render(<Harness {...defaultProps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'unsaved edit' } });
    expect(screen.getByRole('button', { name: /suggest improvements/i })).toBeDisabled();
  });

  it('Suggest improvements calls onSuggestClick when clean and feedback exists', () => {
    const onSuggestClick = vi.fn();
    render(<Harness {...defaultProps} onSuggestClick={onSuggestClick} />);
    fireEvent.click(screen.getByRole('button', { name: /suggest improvements/i }));
    expect(onSuggestClick).toHaveBeenCalledOnce();
  });

  it('Suggest improvements is disabled when no new feedback', () => {
    render(<Harness {...defaultProps} newFeedback={[]} />);
    expect(screen.getByRole('button', { name: /suggest improvements/i })).toBeDisabled();
  });

  it('shows feedback breakdown in the suggest section', () => {
    render(<Harness {...defaultProps} />);
    expect(screen.getByText(/3 new interactions/)).toBeInTheDocument();
    expect(screen.getByText(/1 star/)).toBeInTheDocument();
    expect(screen.getByText(/1 dismiss/)).toBeInTheDocument();
    expect(screen.getByText(/1 comment/)).toBeInTheDocument();
  });

  it('shows no-feedback message when newFeedback is empty', () => {
    render(<Harness {...defaultProps} newFeedback={[]} />);
    expect(screen.getByText(/no new feedback/i)).toBeInTheDocument();
  });

  it('renders MigrationNotice when notice prop is non-null', () => {
    render(
      <Harness
        {...defaultProps}
        migrationNotice={{ type: 'phase1-conflict', discardedContent: 'old' }}
      />
    );
    expect(screen.getByText(/previous Scoring Criteria was different/i)).toBeInTheDocument();
  });

  it('does not render MigrationNotice when notice is null', () => {
    render(<Harness {...defaultProps} migrationNotice={null} />);
    expect(screen.queryByText(/previous Scoring Criteria was different/i)).toBeNull();
  });

  it('disables textarea and action buttons when disabled prop is true', () => {
    render(<Harness {...defaultProps} disabled />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /suggest improvements/i })).toBeDisabled();
  });
});
