import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DiffPreview from '../../../components/profile/DiffPreview.jsx';

describe('DiffPreview', () => {
  it('renders unchanged text when before === after', () => {
    const { container } = render(<DiffPreview before="hello world" after="hello world" />);
    expect(container.textContent).toContain('hello world');
    // No added or removed tokens
    expect(container.querySelector('.bg-green-900\\/30')).toBeNull();
    expect(container.querySelector('.bg-red-900\\/30')).toBeNull();
  });

  it('highlights added words with green class', () => {
    const { container } = render(<DiffPreview before="hello" after="hello world" />);
    const addedSpans = container.querySelectorAll('.bg-green-900\\/30');
    expect(addedSpans.length).toBeGreaterThan(0);
    const addedText = Array.from(addedSpans)
      .map((s) => s.textContent)
      .join('');
    expect(addedText).toMatch(/world/);
  });

  it('highlights removed words with red class', () => {
    const { container } = render(<DiffPreview before="hello world" after="hello" />);
    const removedSpans = container.querySelectorAll('.bg-red-900\\/30');
    expect(removedSpans.length).toBeGreaterThan(0);
    const removedText = Array.from(removedSpans)
      .map((s) => s.textContent)
      .join('');
    expect(removedText).toMatch(/world/);
  });

  it('renders both add and remove in a mixed diff', () => {
    const { container } = render(
      <DiffPreview before="I study flows" after="I study interpretability" />
    );
    expect(container.querySelector('.bg-green-900\\/30')).not.toBeNull();
    expect(container.querySelector('.bg-red-900\\/30')).not.toBeNull();
  });

  it('adds a title attribute to added spans matching a change excerpt', () => {
    const { container } = render(
      <DiffPreview
        before="I study flows"
        after="I study interpretability"
        changes={[
          {
            excerpt: 'interpretability',
            rationale: 'Added because the user starred mech interp papers',
          },
        ]}
      />
    );
    const titled = container.querySelector('[title*="mech interp"]');
    expect(titled).not.toBeNull();
  });

  it('does not fail when a change excerpt does not match any added token', () => {
    expect(() =>
      render(
        <DiffPreview
          before="I study flows"
          after="I study interpretability"
          changes={[{ excerpt: 'nonexistent phrase', rationale: 'should be skipped' }]}
        />
      )
    ).not.toThrow();
  });

  it('renders nothing gracefully when both inputs are empty', () => {
    const { container } = render(<DiffPreview before="" after="" />);
    expect(container.firstChild).not.toBeNull(); // renders a wrapper
  });
});
