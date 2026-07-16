import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StarterTemplatePicker, {
  TEMPLATE_PICKER_DISMISSED_KEY,
} from '../../../components/profile/StarterTemplatePicker.jsx';
import {
  BLANK_PROFILE_TEMPLATE,
  STARTER_TEMPLATES,
} from '../../../lib/profile/starterTemplates.js';

// A profile in the shipped fresh-install state: content is exactly the
// blank template and there is no edit history.
const freshProfile = {
  content: BLANK_PROFILE_TEMPLATE,
  updatedAt: 1700000000000,
  lastFeedbackCutoff: 0,
  revisions: [],
};

describe('StarterTemplatePicker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders all four template cards for a fresh (unedited) profile', () => {
    render(
      <StarterTemplatePicker profile={freshProfile} updateProfile={vi.fn()} setConfig={vi.fn()} />
    );
    expect(screen.getByText('Start from a template')).toBeInTheDocument();
    for (const template of STARTER_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /use this template/i })).toHaveLength(4);
  });

  it('does not render once the profile has been edited', () => {
    render(
      <StarterTemplatePicker
        profile={{ ...freshProfile, content: 'my own research profile' }}
        updateProfile={vi.fn()}
        setConfig={vi.fn()}
      />
    );
    expect(screen.queryByText('Start from a template')).toBeNull();
  });

  it('does not render when the profile has revision history', () => {
    render(
      <StarterTemplatePicker
        profile={{ ...freshProfile, revisions: [{ content: 'old', createdAt: 1 }] }}
        updateProfile={vi.fn()}
        setConfig={vi.fn()}
      />
    );
    expect(screen.queryByText('Start from a template')).toBeNull();
  });

  it('choosing a template sets profile content AND selectedCategories, then dismisses', () => {
    const updateProfile = vi.fn();
    const setConfig = vi.fn();
    render(
      <StarterTemplatePicker
        profile={freshProfile}
        updateProfile={updateProfile}
        setConfig={setConfig}
      />
    );
    // First card is the featured focused example.
    fireEvent.click(screen.getAllByRole('button', { name: /use this template/i })[0]);

    const featured = STARTER_TEMPLATES[0];
    expect(featured.id).toBe('focused-example');
    expect(updateProfile).toHaveBeenCalledWith(featured.profileText);
    // setConfig receives an updater; apply it to verify the categories.
    const updater = setConfig.mock.calls[0][0];
    expect(updater({ selectedCategories: ['cs.LG'] }).selectedCategories).toEqual(
      featured.categories
    );
    // Choice dismisses the picker permanently.
    expect(window.localStorage.getItem(TEMPLATE_PICKER_DISMISSED_KEY)).toBe('true');
    expect(screen.queryByText('Start from a template')).toBeNull();
  });

  it('Start from scratch clears the profile and dismisses', () => {
    const updateProfile = vi.fn();
    render(
      <StarterTemplatePicker
        profile={freshProfile}
        updateProfile={updateProfile}
        setConfig={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));
    expect(updateProfile).toHaveBeenCalledWith('');
    expect(window.localStorage.getItem(TEMPLATE_PICKER_DISMISSED_KEY)).toBe('true');
  });

  it('dismissal persists across remounts', () => {
    const first = render(
      <StarterTemplatePicker profile={freshProfile} updateProfile={vi.fn()} setConfig={vi.fn()} />
    );
    // The rendered apostrophe is a typographic right single quote (U+2019).
    fireEvent.click(screen.getByRole('button', { name: /don.t show this again/i }));
    expect(screen.queryByText('Start from a template')).toBeNull();
    first.unmount();

    render(
      <StarterTemplatePicker profile={freshProfile} updateProfile={vi.fn()} setConfig={vi.fn()} />
    );
    expect(screen.queryByText('Start from a template')).toBeNull();
  });
});
