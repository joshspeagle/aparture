import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExecutiveSummary from '../../components/briefing/ExecutiveSummary.jsx';

describe('ExecutiveSummary', () => {
  it('renders the summary text in a paragraph', () => {
    render(<ExecutiveSummary text="Today in ML, three threads pull on the same knot." />);
    expect(
      screen.getByText(/Today in ML, three threads pull on the same knot\./)
    ).toBeInTheDocument();
  });
});
