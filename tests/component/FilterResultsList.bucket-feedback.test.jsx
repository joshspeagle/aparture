import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterResultsList from '../../components/filter/FilterResultsList.jsx';

describe('FilterResultsList — bucket feedback', () => {
  const filterResults = { yes: [], maybe: [], no: [] };

  it('renders a + feedback trigger in each bucket header', () => {
    render(
      <FilterResultsList
        filterResults={filterResults}
        bucketFeedbackByBucket={{}}
        onBucketFeedback={() => {}}
        onSetVerdict={() => {}}
      />
    );
    const triggers = screen.getAllByText('+ feedback on this bucket');
    expect(triggers).toHaveLength(3);
  });

  it('save fires onBucketFeedback with bucket and text', () => {
    const onBucketFeedback = vi.fn();
    render(
      <FilterResultsList
        filterResults={filterResults}
        bucketFeedbackByBucket={{}}
        onBucketFeedback={onBucketFeedback}
        onSetVerdict={() => {}}
      />
    );
    fireEvent.click(screen.getAllByText('+ feedback on this bucket')[0]);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'too narrow' } });
    fireEvent.click(screen.getByText('save'));
    expect(onBucketFeedback).toHaveBeenCalledWith(expect.objectContaining({ text: 'too narrow' }));
  });
});
