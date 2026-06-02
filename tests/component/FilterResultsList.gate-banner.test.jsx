import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterResultsList from '../../components/filter/FilterResultsList.jsx';

const mkPaper = (id) => ({
  id,
  arxivId: id,
  title: `Paper ${id}`,
  authors: ['A'],
  originalVerdict: 'YES',
});
const results = { yes: [mkPaper('a')], maybe: [], no: [], inProgress: false };
const sorted = { scoredYesCount: 0, scoredMaybeCount: 0 };

const base = {
  filterResults: results,
  filterSortedPapers: sorted,
  onSetVerdict: () => {},
  onContinueAfterFilter: () => {},
  onSkipRemainingGates: () => {},
};

describe('FilterResultsList gate banner', () => {
  it('shows the banner at filter-review stage', () => {
    render(
      <FilterResultsList {...base} processing={{ stage: 'filter-review', isRunning: true }} />
    );
    expect(screen.getByText(/Filter complete — review verdicts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to scoring/ })).toBeInTheDocument();
  });

  it('hides the banner at non-gate stages', () => {
    render(<FilterResultsList {...base} processing={{ stage: 'scoring', isRunning: true }} />);
    expect(screen.queryByRole('button', { name: /Continue to scoring/ })).not.toBeInTheDocument();
  });

  it('Continue fires onContinueAfterFilter', () => {
    const onContinue = vi.fn();
    render(
      <FilterResultsList
        {...base}
        onContinueAfterFilter={onContinue}
        processing={{ stage: 'filter-review', isRunning: true }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue to scoring/ }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('Skip fires onSkipRemainingGates', () => {
    const onSkip = vi.fn();
    render(
      <FilterResultsList
        {...base}
        onSkipRemainingGates={onSkip}
        processing={{ stage: 'filter-review', isRunning: true }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Skip remaining gates/i }));
    expect(onSkip).toHaveBeenCalled();
  });
});
