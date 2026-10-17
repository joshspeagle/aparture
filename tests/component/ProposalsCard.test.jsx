import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProposalsCard from '../../components/profile/ProposalsCard.jsx';
import SuggestDialog from '../../components/profile/SuggestDialog.jsx';
import { normalizeSuggestionResponse } from '../../lib/profile/requestSuggestion.js';

const response = normalizeSuggestionResponse({
  changes: [
    {
      id: 'c1',
      rationale: 'Your answer on 2610.00001.',
      edit: { type: 'insert', anchor: 'flows', content: ' and diffusion models' },
    },
  ],
  noteChanges: [
    {
      id: 'n1',
      rationale: 'Quotes "lead with results".',
      action: 'add',
      noteId: null,
      scope: 'writing',
      text: 'Lead with results.',
    },
  ],
});
const sentEvents = [{ id: 'e1', type: 'answer', arxivId: '2610.00001', text: 'Yes' }];

describe('ProposalsCard', () => {
  it('counts profile and note changes and opens the review', () => {
    const onReview = vi.fn();
    render(<ProposalsCard pending={{ response, sentEvents }} onReview={onReview} />);
    expect(screen.getByText('2 proposed changes to your profile')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Review proposals'));
    expect(onReview).toHaveBeenCalled();
  });

  it('renders nothing without proposals', () => {
    const { container } = render(<ProposalsCard pending={null} onReview={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SuggestDialog with prepared proposals', () => {
  it('opens at the review step and applies without asking the model again', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const onAccept = vi.fn();
    const props = {
      onClose: () => {},
      profile: 'I study flows.',
      notes: [],
      newFeedback: sentEvents,
      briefingHistory: [],
      cap: { commentCap: 30 },
      briefingModel: 'claude-opus-5.5',
      provider: 'anthropic',
      password: 'pw',
      onAccept,
      preset: { response, sentEvents },
    };
    const { rerender } = render(<SuggestDialog {...props} isOpen={false} />);
    rerender(<SuggestDialog {...props} isOpen />);
    expect(screen.getByText('Add a writing note')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Apply 2 of 2/));
    expect(fetchSpy).not.toHaveBeenCalled();
    const outcome = onAccept.mock.calls[0][0];
    expect(outcome.content).toBe('I study flows and diffusion models.');
    expect(outcome.notes).toEqual([
      expect.objectContaining({ text: 'Lead with results.', scope: 'writing' }),
    ]);
    expect(outcome.incorporatedEventIds).toEqual(['e1']);
    fetchSpy.mockRestore();
  });
});
