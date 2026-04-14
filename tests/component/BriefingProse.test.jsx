import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BriefingProse from '../../components/briefing/BriefingProse.jsx';

describe('BriefingProse', () => {
  it('wraps children in the briefing-prose class', () => {
    render(
      <BriefingProse>
        <p>Hello reader.</p>
      </BriefingProse>
    );
    const para = screen.getByText('Hello reader.');
    const wrapper = para.closest('.briefing-prose');
    expect(wrapper).not.toBeNull();
  });
});
