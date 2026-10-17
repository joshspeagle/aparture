import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressTimeline from '../../components/run/ProgressTimeline.jsx';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';

const setStage = (stage) =>
  useAnalyzerStore.setState((s) => ({
    processing: { ...s.processing, stage, isRunning: true, progress: { current: 3, total: 9 } },
  }));

describe('ProgressTimeline — review gates read as waiting, not running', () => {
  beforeEach(() => {
    useAnalyzerStore.setState((s) => ({
      filterResults: { ...s.filterResults, yes: [{}], maybe: [], no: [] },
    }));
  });

  it('marks filtering done and scoring as waiting at the filter gate', () => {
    setStage('filter-review');
    render(<ProgressTimeline />);
    expect(screen.getByText('1 YES / 0 MAYBE / 0 NO')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for you: review the filter results/)).toBeInTheDocument();
    expect(screen.queryByText('Filtering papers...')).not.toBeInTheDocument();
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });

  it('holds PDF analysis at the score gate and the briefing at the pre-briefing gate', () => {
    setStage('score-review');
    const { unmount } = render(<ProgressTimeline />);
    expect(screen.getByText(/Waiting for you: review the scores/)).toBeInTheDocument();
    unmount();

    setStage('pre-briefing-review');
    render(<ProgressTimeline />);
    expect(screen.getByText(/continue below to write the briefing/)).toBeInTheDocument();
  });

  it('still shows a running stage and its progress outside the gates', () => {
    setStage('initial-scoring');
    render(<ProgressTimeline />);
    expect(screen.getByText('Scoring abstracts (3/9)...')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });
});
