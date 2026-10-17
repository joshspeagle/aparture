import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExecutiveSummary, { splitParagraphs } from '../../components/briefing/ExecutiveSummary.jsx';

describe('ExecutiveSummary', () => {
  it('renders the summary text in a paragraph', () => {
    render(<ExecutiveSummary text="Today in ML, three threads pull on the same knot." />);
    expect(
      screen.getByText(/Today in ML, three threads pull on the same knot\./)
    ).toBeInTheDocument();
  });

  it('renders each paragraph of a multi-paragraph lede as its own <p>', () => {
    // The prompt asks for 2–4 paragraphs; one <p> merged them into one block.
    const { container } = render(
      <ExecutiveSummary
        text={'The headline paragraph.\n\nThe clusters paragraph.\n\nIf you read one paper today.'}
      />
    );
    const paras = container.querySelectorAll('p');
    expect(paras).toHaveLength(3);
    expect(paras[1].textContent).toBe('The clusters paragraph.');
  });

  it('also splits paragraphs the model separated with single newlines', () => {
    expect(splitParagraphs('First.\nSecond.')).toEqual(['First.', 'Second.']);
  });

  it('keeps soft line breaks inside a blank-line-delimited paragraph', () => {
    expect(splitParagraphs('One line\ncontinued.\n\nNext.')).toEqual([
      'One line continued.',
      'Next.',
    ]);
  });

  it('renders nothing for an empty summary', () => {
    const { container } = render(<ExecutiveSummary text="" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
