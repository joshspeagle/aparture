import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GeneralCommentInput from '../../../components/feedback/GeneralCommentInput.jsx';

describe('GeneralCommentInput', () => {
  it('renders the Add a comment button in the collapsed state', () => {
    render(<GeneralCommentInput onSave={() => {}} />);
    expect(screen.getByRole('button', { name: /add a comment/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('expands to show a textarea when the trigger is clicked', () => {
    render(<GeneralCommentInput onSave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onSave with the text and collapses back after Save', () => {
    const onSave = vi.fn();
    render(<GeneralCommentInput onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'too much theory this week' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith('too much theory this week');
    // Back to collapsed
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: /add a comment/i })).toBeInTheDocument();
  });

  it('collapses without calling onSave when Cancel is clicked', () => {
    const onSave = vi.fn();
    render(<GeneralCommentInput onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'partial' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('clears the textarea between consecutive Save cycles', () => {
    const onSave = vi.fn();
    render(<GeneralCommentInput onSave={onSave} />);
    // First save
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'first' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    // Second expand — textarea should be empty, not preloaded with 'first'
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('disables Save when the textarea is empty or whitespace only', () => {
    render(<GeneralCommentInput onSave={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /add a comment/i }));
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).toBeDisabled();
    // Whitespace-only
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(save).toBeDisabled();
    // Real content
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'thought' } });
    expect(save).not.toBeDisabled();
  });
});
