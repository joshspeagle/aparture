import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeedbackHeader from '../../../components/feedback/FeedbackHeader.jsx';

describe('FeedbackHeader — staleness suffix on Suggest button', () => {
  it('omits "(N new)" suffix when newCount is 0', () => {
    render(
      <FeedbackHeader
        newCount={0}
        totalCount={5}
        onSuggestClick={() => {}}
        lastFeedbackCutoff={1234567890}
      />
    );
    expect(screen.getByText(/Suggest improvements/i)).toBeInTheDocument();
    expect(screen.queryByText(/\(0 new\)/)).not.toBeInTheDocument();
  });

  it('omits suffix when lastFeedbackCutoff is null', () => {
    render(
      <FeedbackHeader
        newCount={12}
        totalCount={12}
        onSuggestClick={() => {}}
        lastFeedbackCutoff={null}
      />
    );
    expect(screen.queryByText(/\(12 new\)/)).not.toBeInTheDocument();
  });

  it('shows "(N new)" suffix when newCount > 0 and cutoff is set', () => {
    render(
      <FeedbackHeader
        newCount={12}
        totalCount={20}
        onSuggestClick={() => {}}
        lastFeedbackCutoff={1234567890}
      />
    );
    expect(screen.getByText(/Suggest improvements \(12 new\)/i)).toBeInTheDocument();
  });
});
