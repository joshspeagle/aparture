import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProactiveQuestionPanel from '../../components/briefing/ProactiveQuestionPanel.jsx';

describe('ProactiveQuestionPanel', () => {
  it('renders the question and skip button', () => {
    render(
      <ProactiveQuestionPanel
        question="You've starred 3 papers on normalizing flows this week. Should I weight flow-based methods higher in scoring?"
        onSkip={() => {}}
        onPreview={() => {}}
      />
    );
    expect(screen.getByText(/A QUESTION FROM APARTURE/i)).toBeInTheDocument();
    expect(screen.getByText(/starred 3 papers on normalizing flows/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('fires onSkip when skip is clicked', async () => {
    const onSkip = vi.fn();
    render(<ProactiveQuestionPanel question="q?" onSkip={onSkip} onPreview={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('calls onPreview with the textarea content when preview is clicked', async () => {
    const onPreview = vi.fn();
    render(<ProactiveQuestionPanel question="q?" onSkip={() => {}} onPreview={onPreview} />);
    await userEvent.type(screen.getByRole('textbox'), 'yes widen RLHF');
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
    expect(onPreview).toHaveBeenCalledWith('yes widen RLHF');
  });
});
