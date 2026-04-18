import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DiffPreview from '../../components/profile/DiffPreview.jsx';

describe('DiffPreview (per-hunk)', () => {
  const baseProfile = 'Bayesian methods for astrophysics.';
  const changes = [
    {
      id: 'c1',
      rationale: 'Narrow scope',
      edit: { type: 'replace', anchor: 'Bayesian methods', content: 'probabilistic inference' },
    },
    {
      id: 'c2',
      rationale: 'Specialize domain',
      edit: { type: 'replace', anchor: 'astrophysics', content: 'cosmology' },
    },
  ];

  test('renders one card per change with rationale and diff', () => {
    render(<DiffPreview currentProfile={baseProfile} changes={changes} onApply={() => {}} />);
    expect(screen.getByText('Narrow scope')).toBeInTheDocument();
    expect(screen.getByText('Specialize domain')).toBeInTheDocument();
  });

  test('cumulative preview reflects current selection', () => {
    render(<DiffPreview currentProfile={baseProfile} changes={changes} onApply={() => {}} />);
    // By default all checked → preview should apply both
    expect(screen.getByTestId('cumulative-preview')).toHaveTextContent(
      'probabilistic inference for cosmology'
    );

    // Uncheck c2 → only c1 applies
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(screen.getByTestId('cumulative-preview')).toHaveTextContent(
      'probabilistic inference for astrophysics'
    );
  });

  test('apply button invokes callback with selected IDs and resulting text', () => {
    const onApply = vi.fn();
    render(<DiffPreview currentProfile={baseProfile} changes={changes} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedIds: ['c1', 'c2'],
        resultText: 'probabilistic inference for cosmology.',
      })
    );
  });

  test('apply button is disabled when no changes selected', () => {
    render(<DiffPreview currentProfile={baseProfile} changes={changes} onApply={() => {}} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
  });

  test('select none clears all and select all restores', () => {
    render(<DiffPreview currentProfile={baseProfile} changes={changes} onApply={() => {}} />);
    fireEvent.click(screen.getByText(/select none/i));
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/select all/i));
    expect(screen.getByRole('button', { name: /apply/i })).not.toBeDisabled();
  });

  test('button label reflects count of selected changes', () => {
    render(<DiffPreview currentProfile={baseProfile} changes={changes} onApply={() => {}} />);
    expect(screen.getByRole('button', { name: /apply 2 of 2/i })).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: /apply 1 of 2/i })).toBeInTheDocument();
  });

  test('supports insert edit type', () => {
    const insertChanges = [
      {
        id: 'ins1',
        rationale: 'Expand scope',
        edit: { type: 'insert', anchor: 'astrophysics', content: ' and cosmology' },
      },
    ];
    render(
      <DiffPreview currentProfile={baseProfile} changes={insertChanges} onApply={() => {}} />
    );
    expect(screen.getByTestId('cumulative-preview')).toHaveTextContent(
      'Bayesian methods for astrophysics and cosmology.'
    );
  });

  test('supports delete edit type', () => {
    const deleteChanges = [
      {
        id: 'd1',
        rationale: 'Drop stale area',
        edit: { type: 'delete', anchor: 'Bayesian methods for ', content: '' },
      },
    ];
    render(
      <DiffPreview currentProfile={baseProfile} changes={deleteChanges} onApply={() => {}} />
    );
    expect(screen.getByTestId('cumulative-preview')).toHaveTextContent('astrophysics.');
  });
});
