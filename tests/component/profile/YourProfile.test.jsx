import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import YourProfile from '../../../components/profile/YourProfile.jsx';

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
    newInteractionCount: 5,
    onScrollToFeedback: vi.fn(),
    onPreviewClick: vi.fn(),
    onSuggestClick: vi.fn(),
  };

  it('renders the panel title', () => {
    render(<YourProfile {...defaultProps} />);
    expect(screen.getByText(/your profile/i)).toBeInTheDocument();
  });

  it('renders a textarea bound to profile.content', () => {
    render(<YourProfile {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('I study mechanistic interpretability.');
  });

  it('calls updateProfile when textarea changes', () => {
    const updateProfile = vi.fn();
    render(<YourProfile {...defaultProps} updateProfile={updateProfile} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new content' } });
    expect(updateProfile).toHaveBeenCalledWith('new content');
  });

  it('renders StatusRow with the correct count', () => {
    render(<YourProfile {...defaultProps} newInteractionCount={12} />);
    expect(screen.getByText(/12 new interactions/i)).toBeInTheDocument();
  });

  it('calls onPreviewClick when Preview button is clicked', () => {
    const onPreviewClick = vi.fn();
    render(<YourProfile {...defaultProps} onPreviewClick={onPreviewClick} />);
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    expect(onPreviewClick).toHaveBeenCalledOnce();
  });

  it('calls onSuggestClick when Suggest button is clicked', () => {
    const onSuggestClick = vi.fn();
    render(<YourProfile {...defaultProps} onSuggestClick={onSuggestClick} />);
    fireEvent.click(screen.getByRole('button', { name: /suggest improvements/i }));
    expect(onSuggestClick).toHaveBeenCalledOnce();
  });

  it('renders MigrationNotice when notice prop is non-null', () => {
    render(
      <YourProfile
        {...defaultProps}
        migrationNotice={{ type: 'phase1-conflict', discardedContent: 'old' }}
      />
    );
    expect(screen.getByText(/previous Scoring Criteria was different/i)).toBeInTheDocument();
  });

  it('does not render MigrationNotice when notice is null', () => {
    render(<YourProfile {...defaultProps} migrationNotice={null} />);
    expect(screen.queryByText(/previous Scoring Criteria was different/i)).toBeNull();
  });

  it('disables textarea and buttons when disabled prop is true', () => {
    render(<YourProfile {...defaultProps} disabled />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /suggest improvements/i })).toBeDisabled();
  });
});
