import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditorQuestions from '../../components/briefing/EditorQuestions.jsx';

const question = {
  id: 'q1',
  text: 'No galaxy-formation paper made the list. Reserve a slot?',
  options: ['Yes, reserve a slot', 'No, rank by score alone'],
  evidence: ['2610.21628'],
};

describe('EditorQuestions', () => {
  it('renders nothing without questions', () => {
    const { container } = render(<EditorQuestions questions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sends the tapped answer with its question, evidence and day', () => {
    const onAnswer = vi.fn();
    render(
      <EditorQuestions
        questions={[question]}
        feedbackEvents={[]}
        briefingDate="2026-10-17"
        onAnswer={onAnswer}
      />
    );
    expect(screen.getByText(/Reserve a slot\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, reserve a slot' }));
    expect(onAnswer).toHaveBeenCalledWith({
      questionId: 'q1',
      question: question.text,
      answer: 'Yes, reserve a slot',
      evidence: ['2610.21628'],
      briefingDate: '2026-10-17',
    });
  });

  it("marks the reader's current answer for that day", () => {
    render(
      <EditorQuestions
        questions={[question]}
        briefingDate="2026-10-17"
        feedbackEvents={[
          {
            type: 'answer',
            questionId: 'q1',
            question: question.text,
            answer: 'No, rank by score alone',
            briefingDate: '2026-10-16',
          },
          // Another briefing the same day, whose q1 asked something else.
          {
            type: 'answer',
            questionId: 'q1',
            question: 'Theory-only papers keep scoring high. Rank them lower?',
            answer: 'No, rank by score alone',
            briefingDate: '2026-10-17',
          },
          {
            type: 'answer',
            questionId: 'q1',
            question: question.text,
            answer: 'Yes, reserve a slot',
            briefingDate: '2026-10-17',
          },
        ]}
      />
    );
    expect(screen.getByRole('button', { name: 'Yes, reserve a slot' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'No, rank by score alone' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
