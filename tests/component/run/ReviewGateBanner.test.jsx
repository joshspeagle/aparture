import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewGateBanner from '../../../components/run/ReviewGateBanner.jsx';

describe('ReviewGateBanner', () => {
  it('renders title, description, and continue label', () => {
    render(
      <ReviewGateBanner
        title="Score review — 3 papers"
        description="Review before continuing."
        continueLabel="Continue to PDF analysis →"
        onContinue={() => {}}
      />
    );
    expect(screen.getByText('Score review — 3 papers')).toBeInTheDocument();
    expect(screen.getByText('Review before continuing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to PDF analysis/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Score review — 3 papers' })
    ).toBeInTheDocument();
  });

  it('Continue fires onContinue', () => {
    const onContinue = vi.fn();
    render(<ReviewGateBanner title="t" continueLabel="Continue →" onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue →/ }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('skip link renders + fires only when onSkipRemaining provided', () => {
    const onSkip = vi.fn();
    const { rerender } = render(
      <ReviewGateBanner title="t" continueLabel="c" onContinue={() => {}} />
    );
    expect(
      screen.queryByRole('button', { name: /Skip remaining gates this run/i })
    ).not.toBeInTheDocument();
    rerender(
      <ReviewGateBanner
        title="t"
        continueLabel="c"
        onContinue={() => {}}
        onSkipRemaining={onSkip}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Skip remaining gates this run/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('renders children', () => {
    render(
      <ReviewGateBanner title="t" continueLabel="c" onContinue={() => {}}>
        <div data-testid="child">hi</div>
      </ReviewGateBanner>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
