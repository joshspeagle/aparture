import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewGateBanner from '../../components/run/ReviewGateBanner.jsx';

describe('ReviewGateBanner — the pause is noticed', () => {
  afterEach(() => {
    delete window.Element.prototype.scrollIntoView;
  });

  it('scrolls itself into view once and announces the pause', async () => {
    const scrollIntoView = vi.fn();
    window.Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender } = render(
      <ReviewGateBanner title="Review the scores" continueLabel="Continue" onContinue={() => {}} />
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('paused for your review');
    expect(screen.getByRole('region', { name: 'Review the scores' })).toBeInTheDocument();

    rerender(
      <ReviewGateBanner title="Review the scores" continueLabel="Continue" onContinue={() => {}} />
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
