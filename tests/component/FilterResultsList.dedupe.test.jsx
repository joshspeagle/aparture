import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FilterResultsList from '../../components/filter/FilterResultsList.jsx';

function defaultProps(overrides = {}) {
  return {
    filterResults: {
      total: 2,
      yes: [],
      maybe: [],
      no: [],
      inProgress: false,
      currentBatch: 0,
      totalBatches: 0,
      ...(overrides.filterResults ?? {}),
    },
    filterSortedPapers: {
      scoredPaperIds: new Set(),
      unscoredYes: [],
      unscoredMaybe: [],
      unscoredNo: [],
      scoredYesCount: 0,
      scoredMaybeCount: 0,
      ...(overrides.filterSortedPapers ?? {}),
    },
    testState: { dryRunInProgress: false, ...(overrides.testState ?? {}) },
    processing: { isRunning: false, stage: 'idle', ...(overrides.processing ?? {}) },
    onSetVerdict: vi.fn(),
  };
}

describe('FilterResultsList — DuplicateBadge rendering', () => {
  it('renders a DuplicateBadge next to title when paper.isDuplicate is true', () => {
    const props = defaultProps({
      filterResults: {
        total: 1,
        yes: [
          {
            id: '2605.14205',
            title: 'A Paper Title',
            authors: ['Author One'],
            filterVerdict: 'YES',
            isDuplicate: true,
            firstSeenDate: '2026-05-10',
          },
        ],
        maybe: [],
        no: [],
      },
    });
    render(<FilterResultsList {...props} />);
    expect(screen.getByText('A Paper Title')).toBeInTheDocument();
    expect(screen.getByText(/seen 2026-05-10/i)).toBeInTheDocument();
  });

  it('does not render badge when paper.isDuplicate is falsy', () => {
    const props = defaultProps({
      filterResults: {
        total: 1,
        yes: [
          {
            id: '2605.14205',
            title: 'Non-duplicate Paper',
            authors: ['Author One'],
            filterVerdict: 'YES',
          },
        ],
        maybe: [],
        no: [],
      },
    });
    render(<FilterResultsList {...props} />);
    expect(screen.getByText('Non-duplicate Paper')).toBeInTheDocument();
    expect(screen.queryByText(/seen/i)).not.toBeInTheDocument();
  });

  it('renders badge in MAYBE and NO sections too (not just YES)', () => {
    const props = defaultProps({
      filterResults: {
        total: 2,
        yes: [],
        maybe: [
          {
            id: '2605.14211',
            title: 'Maybe Paper',
            authors: ['Author Two'],
            filterVerdict: 'MAYBE',
            isDuplicate: true,
            firstSeenDate: '2026-05-12',
          },
        ],
        no: [
          {
            id: '2605.14212',
            title: 'No Paper',
            authors: ['Author Three'],
            filterVerdict: 'NO',
            isDuplicate: true,
            firstSeenDate: '2026-04-22',
          },
        ],
      },
    });
    render(<FilterResultsList {...props} />);
    expect(screen.getByText(/seen 2026-05-12/i)).toBeInTheDocument();
    expect(screen.getByText(/seen 2026-04-22/i)).toBeInTheDocument();
  });
});
