import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DebateBlock from '../../components/briefing/DebateBlock.jsx';

describe('DebateBlock', () => {
  it('renders the debate label, title, and summary', () => {
    render(
      <DebateBlock
        title="Are attention heads the right unit?"
        summary="Smith argues yes; Chen counters that activation patches are more reliable."
        paperIds={['2504.01234', '2504.02345']}
      />
    );
    expect(screen.getByText(/⚡.*DEBATE/)).toBeInTheDocument();
    expect(screen.getByText(/Are attention heads the right unit/)).toBeInTheDocument();
    expect(screen.getByText(/Smith argues yes/)).toBeInTheDocument();
  });
});
