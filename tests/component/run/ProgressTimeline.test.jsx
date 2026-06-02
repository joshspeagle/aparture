import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressTimeline from '../../../components/run/ProgressTimeline.jsx';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

function seed(stage) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    processing: {
      stage,
      isRunning: true,
      isPaused: true,
      progress: { current: 0, total: 0 },
      statusLog: [],
      errors: [],
    },
    filterResults: { yes: [{ id: 'a' }], maybe: [], no: [] },
    results: { finalRanking: [] },
    skippedDueToRecaptcha: [],
  });
}

describe('ProgressTimeline no longer hosts gate controls', () => {
  it('renders no "Continue to scoring" at filter-review', () => {
    seed('filter-review');
    render(<ProgressTimeline onSetVerdict={() => {}} />);
    expect(screen.queryByText(/Continue to scoring/)).not.toBeInTheDocument();
  });

  it('renders no "Continue to briefing" at pre-briefing-review', () => {
    seed('pre-briefing-review');
    render(<ProgressTimeline onSetVerdict={() => {}} />);
    expect(screen.queryByText(/Continue to briefing/)).not.toBeInTheDocument();
  });
});
