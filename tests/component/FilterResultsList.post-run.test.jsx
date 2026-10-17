import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterResultsList from '../../components/filter/FilterResultsList.jsx';

const paper = {
  id: 'a',
  arxivId: '2610.00001',
  title: 'Paper a',
  authors: ['A'],
  originalVerdict: 'NO',
};
const base = {
  filterResults: { yes: [], maybe: [], no: [paper], inProgress: false },
  filterSortedPapers: { scoredYesCount: 0, scoredMaybeCount: 0 },
};

describe('FilterResultsList after the run (P1-6)', () => {
  it('keeps the pills live and explains that a change is saved as feedback only', () => {
    const onSetVerdict = vi.fn();
    render(
      <FilterResultsList
        {...base}
        onSetVerdict={onSetVerdict}
        processing={{ stage: 'complete', isRunning: false }}
      />
    );
    expect(screen.getByTestId('post-run-override-note')).toHaveTextContent(
      /saved as feedback for your profile/i
    );
    fireEvent.click(screen.getByRole('radio', { name: 'YES' }));
    expect(onSetVerdict).toHaveBeenCalledWith('a', 'NO', 'YES');
  });

  it('does not show the note while a run is in progress', () => {
    render(
      <FilterResultsList
        {...base}
        onSetVerdict={() => {}}
        processing={{ stage: 'filter-review', isRunning: true }}
        onContinueAfterFilter={() => {}}
      />
    );
    expect(screen.queryByTestId('post-run-override-note')).toBeNull();
  });
});
