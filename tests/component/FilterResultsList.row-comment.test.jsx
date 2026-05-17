import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterResultsList from '../../components/filter/FilterResultsList.jsx';

const samplePaper = {
  arxivId: '2511.0001',
  id: '2511.0001',
  title: 'Test paper',
  authors: ['Author A'],
  filterSummary: 's',
  filterJustification: 'j',
};

describe('FilterResultsList — per-row paper comment', () => {
  const filterResults = { yes: [samplePaper], maybe: [], no: [] };

  it('renders a 💬 trigger on each filter row', () => {
    render(
      <FilterResultsList
        filterResults={filterResults}
        bucketFeedbackByBucket={{}}
        onBucketFeedback={() => {}}
        onSetVerdict={() => {}}
        onAddPaperComment={() => {}}
      />
    );
    expect(screen.getByText(/add comment/i)).toBeInTheDocument();
  });

  it('saving a comment calls onAddPaperComment with arxivId + text', () => {
    const onAddPaperComment = vi.fn();
    render(
      <FilterResultsList
        filterResults={filterResults}
        bucketFeedbackByBucket={{}}
        onBucketFeedback={() => {}}
        onSetVerdict={() => {}}
        onAddPaperComment={onAddPaperComment}
      />
    );
    fireEvent.click(screen.getByText(/add comment/i));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rationale' } });
    fireEvent.click(screen.getByText(/^save$/i));
    expect(onAddPaperComment).toHaveBeenCalledWith(
      expect.objectContaining({ arxivId: '2511.0001', text: 'rationale' })
    );
  });
});
