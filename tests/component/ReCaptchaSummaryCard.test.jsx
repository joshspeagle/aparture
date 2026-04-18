// End-of-run summary card listing all papers skipped due to missing
// Playwright + reCAPTCHA. Verifies the list render, the install hint,
// and the empty-state early-return.

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReCaptchaSummaryCard from '../../components/run/ReCaptchaSummaryCard.jsx';

describe('ReCaptchaSummaryCard', () => {
  test('renders count and lists skipped papers', () => {
    const skipped = [
      { arxivId: '2501.00001', title: 'First' },
      { arxivId: '2501.00002', title: 'Second' },
      { arxivId: '2501.00003', title: 'Third' },
    ];
    render(<ReCaptchaSummaryCard skipped={skipped} />);
    expect(screen.getByText(/3 papers/)).toBeInTheDocument();
    expect(screen.getByText(/First/)).toBeInTheDocument();
    expect(screen.getByText(/Third/)).toBeInTheDocument();
    expect(screen.getByText(/npx playwright install chromium/)).toBeInTheDocument();
  });

  test('returns null when skipped list is empty', () => {
    const { container } = render(<ReCaptchaSummaryCard skipped={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('returns null when skipped is undefined', () => {
    const { container } = render(<ReCaptchaSummaryCard />);
    expect(container.firstChild).toBeNull();
  });
});
