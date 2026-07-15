import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileSwitcher from '../../../components/profile/ProfileSwitcher.jsx';

const twoProfiles = {
  Default: { content: 'default content', updatedAt: 1700000000000 },
  Cosmology: { content: 'cosmology content', updatedAt: 1700000001000 },
};

describe('ProfileSwitcher', () => {
  const defaultProps = {
    profiles: twoProfiles,
    activeProfileName: 'Default',
    saveAs: vi.fn(),
    switchTo: vi.fn(),
    deleteProfile: vi.fn(),
    renameProfile: vi.fn(),
  };

  it('shows the active profile name as the selected option', () => {
    render(<ProfileSwitcher {...defaultProps} />);
    expect(screen.getByLabelText('Active profile')).toHaveValue('Default');
  });

  it('shows the memory-framing hint', () => {
    render(<ProfileSwitcher {...defaultProps} />);
    expect(screen.getByText('The active profile is what every run reads.')).toBeInTheDocument();
  });

  it('selecting another name calls switchTo', () => {
    const switchTo = vi.fn();
    render(<ProfileSwitcher {...defaultProps} switchTo={switchTo} />);
    fireEvent.change(screen.getByLabelText('Active profile'), {
      target: { value: 'Cosmology' },
    });
    expect(switchTo).toHaveBeenCalledWith('Cosmology');
  });

  it('Save as… flow calls saveAs with the typed name', () => {
    const saveAs = vi.fn();
    render(<ProfileSwitcher {...defaultProps} saveAs={saveAs} />);
    fireEvent.click(screen.getByRole('button', { name: /save as/i }));
    fireEvent.change(screen.getByLabelText('New profile name'), {
      target: { value: 'Methods watch' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(saveAs).toHaveBeenCalledWith('Methods watch');
  });

  it('Rename flow pre-fills the active name and calls renameProfile', () => {
    const renameProfile = vi.fn();
    render(<ProfileSwitcher {...defaultProps} renameProfile={renameProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /^rename$/i }));
    const input = screen.getByLabelText('Rename profile');
    expect(input).toHaveValue('Default');
    fireEvent.change(input, { target: { value: 'Daily' } });
    // The confirm button is also labelled Rename; it is the primary one
    // inside the input row.
    fireEvent.click(screen.getAllByRole('button', { name: /^rename$/i })[1]);
    expect(renameProfile).toHaveBeenCalledWith('Default', 'Daily');
  });

  it('Delete calls deleteProfile with the active name', () => {
    const deleteProfile = vi.fn();
    render(<ProfileSwitcher {...defaultProps} deleteProfile={deleteProfile} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(deleteProfile).toHaveBeenCalledWith('Default');
  });

  it('Delete is disabled when only one profile exists', () => {
    render(
      <ProfileSwitcher
        {...defaultProps}
        profiles={{ Default: twoProfiles.Default }}
        activeProfileName="Default"
      />
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  it('disables all controls when disabled (e.g. dirty draft or running pipeline)', () => {
    render(<ProfileSwitcher {...defaultProps} disabled />);
    expect(screen.getByLabelText('Active profile')).toBeDisabled();
    expect(screen.getByRole('button', { name: /save as/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /rename/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });
});
