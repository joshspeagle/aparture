import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import EditorialNotes from '../../components/profile/EditorialNotes.jsx';
import DiffPreview from '../../components/profile/DiffPreview.jsx';

const note = (id, scope, text, source = 'manual') => ({ id, scope, text, source, createdAt: 1 });

describe('EditorialNotes', () => {
  it('groups notes by scope and says where each came from', () => {
    render(
      <EditorialNotes
        notes={[note('a', 'selection', 'Prefers released code.', 'suggested')]}
        onChange={() => {}}
      />
    );
    const selection = screen.getByRole('region', { name: /Selection/ });
    expect(within(selection).getByText('Prefers released code.')).toBeInTheDocument();
    expect(within(selection).getByText(/From an accepted suggestion/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Writing/ })).toBeInTheDocument();
  });

  it('adds a note in the scope it was typed into', () => {
    const onChange = vi.fn();
    render(<EditorialNotes notes={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('New writing note'), {
      target: { value: 'Lead with the result.' },
    });
    fireEvent.click(within(screen.getByRole('region', { name: /Writing/ })).getByText('Add'));
    const [next, opts] = onChange.mock.calls[0];
    expect(next).toEqual([
      expect.objectContaining({
        scope: 'writing',
        text: 'Lead with the result.',
        source: 'manual',
      }),
    ]);
    expect(opts.rationale).toBe('Added a writing note');
  });

  it('edits and removes a note', () => {
    const onChange = vi.fn();
    const notes = [note('a', 'podcast', 'Slow down.')];
    render(<EditorialNotes notes={notes} onChange={onChange} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Edit note'), { target: { value: 'Keep it brisk.' } });
    fireEvent.click(screen.getByText('Save note'));
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ id: 'a', text: 'Keep it brisk.' });
    fireEvent.click(screen.getByLabelText('Remove note: Slow down.'));
    expect(onChange.mock.calls[1][0]).toEqual([]);
  });

  it('offers no new note in a scope at its limit', () => {
    const full = Array.from({ length: 12 }, (_, i) => note(`s${i}`, 'selection', `Note ${i}`));
    render(<EditorialNotes notes={full} onChange={() => {}} />);
    expect(screen.queryByLabelText('New selection note')).toBeNull();
    expect(screen.getByText(/at its limit/)).toBeInTheDocument();
  });
});

describe('DiffPreview — note changes', () => {
  it('lists note changes beside profile edits and applies the ticked ones', () => {
    const onApply = vi.fn();
    render(
      <DiffPreview
        currentProfile="I study flows."
        changes={[]}
        noteChanges={[
          {
            id: 'note:n1',
            rationale: 'Cites 2610.00001.',
            noteId: 'a',
            note: { action: 'revise', scope: null, text: 'Prefers code and data.' },
          },
          {
            id: 'note:n2',
            rationale: 'Quotes "slower".',
            noteId: null,
            note: { action: 'add', scope: 'podcast', text: 'A slower pace.' },
          },
        ]}
        notes={[note('a', 'selection', 'Prefers released code.')]}
        onApply={onApply}
      />
    );
    expect(screen.getByText('Prefers released code.')).toBeInTheDocument();
    expect(screen.getByText('Add a podcast note')).toBeInTheDocument();
    expect(screen.queryByTestId('cumulative-preview')).toBeNull();
    fireEvent.click(screen.getByLabelText('Add a podcast note'));
    fireEvent.click(screen.getByText(/Apply 1 of 2/));
    expect(onApply).toHaveBeenCalledWith({
      acceptedIds: ['note:n1'],
      resultText: 'I study flows.',
    });
  });
});
