// Per-paper in-timeline notice rendered when a PDF fetch hits reCAPTCHA
// and Playwright isn't installed. Verifies the component surfaces the
// paper metadata plus the install hint.

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlaywrightNotice from '../../components/run/PlaywrightNotice.jsx';

describe('PlaywrightNotice', () => {
  test('renders paper title, arxivId, and install hint', () => {
    render(<PlaywrightNotice arxivId="2501.12345" title="A very cool paper" />);
    expect(screen.getByText(/A very cool paper/)).toBeInTheDocument();
    expect(screen.getByText(/2501.12345/)).toBeInTheDocument();
    expect(screen.getByText(/npx playwright install chromium/)).toBeInTheDocument();
  });
});
