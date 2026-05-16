import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DuplicateBadge from '../../components/ui/DuplicateBadge.jsx';

describe('DuplicateBadge', () => {
  it('renders nothing when isDuplicate is false', () => {
    const { container } = render(<DuplicateBadge isDuplicate={false} firstSeenDate="2026-05-10" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when isDuplicate is undefined', () => {
    const { container } = render(<DuplicateBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "seen YYYY-MM-DD" when isDuplicate=true and firstSeenDate provided', () => {
    render(<DuplicateBadge isDuplicate={true} firstSeenDate="2026-05-10" />);
    expect(screen.getByText(/seen 2026-05-10/i)).toBeInTheDocument();
  });

  it('renders "seen before" when isDuplicate=true but no firstSeenDate', () => {
    render(<DuplicateBadge isDuplicate={true} />);
    expect(screen.getByText(/seen before/i)).toBeInTheDocument();
  });

  it('uses the configured muted color tokens (not status colors)', () => {
    const { container } = render(<DuplicateBadge isDuplicate={true} firstSeenDate="2026-05-10" />);
    const span = container.firstChild;
    // Inline-style attribute should reference --aparture-mute / --aparture-hairline
    // (verifying we don't accidentally use a status color like #22c55e).
    const styleAttr = span.getAttribute('style') ?? '';
    expect(styleAttr).toMatch(/--aparture-mute/);
    expect(styleAttr).toMatch(/--aparture-hairline/);
    expect(styleAttr).not.toMatch(/#22c55e|#f59e0b|#ef4444/);
  });

  it('sets a descriptive title attribute including the date', () => {
    const { container } = render(<DuplicateBadge isDuplicate={true} firstSeenDate="2026-04-22" />);
    expect(container.firstChild.getAttribute('title')).toBe('Seen in a run on 2026-04-22');
  });
});
