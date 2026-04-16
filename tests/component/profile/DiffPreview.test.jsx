import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DiffPreview from '../../../components/profile/DiffPreview.jsx';

// Helper: find spans whose style attribute contains a substring.
// jsdom serialises inline styles as the raw `style` attribute string,
// which is more reliable than the CSSStyleDeclaration shorthand getters.
function findSpansByStyle(container, styleSubstr) {
  return Array.from(container.querySelectorAll('span')).filter((el) => {
    const attr = el.getAttribute('style') ?? '';
    return attr.includes(styleSubstr);
  });
}

describe('DiffPreview', () => {
  it('renders unchanged text when before === after', () => {
    const { container } = render(<DiffPreview before="hello world" after="hello world" />);
    expect(container.textContent).toContain('hello world');
    expect(findSpansByStyle(container, 'rgba(34, 197, 94')).toHaveLength(0);
    expect(findSpansByStyle(container, 'rgba(239, 68, 68')).toHaveLength(0);
  });

  it('highlights added words with green style', () => {
    const { container } = render(<DiffPreview before="hello" after="hello world" />);
    const addedSpans = findSpansByStyle(container, 'rgba(34, 197, 94');
    expect(addedSpans.length).toBeGreaterThan(0);
    const addedText = addedSpans.map((s) => s.textContent).join('');
    expect(addedText).toMatch(/world/);
  });

  it('highlights removed words with red style', () => {
    const { container } = render(<DiffPreview before="hello world" after="hello" />);
    const removedSpans = findSpansByStyle(container, 'rgba(239, 68, 68');
    expect(removedSpans.length).toBeGreaterThan(0);
    const removedText = removedSpans.map((s) => s.textContent).join('');
    expect(removedText).toMatch(/world/);
  });

  it('renders both add and remove in a mixed diff', () => {
    const { container } = render(
      <DiffPreview before="I study flows" after="I study interpretability" />
    );
    expect(findSpansByStyle(container, 'rgba(34, 197, 94').length).toBeGreaterThan(0);
    expect(findSpansByStyle(container, 'rgba(239, 68, 68').length).toBeGreaterThan(0);
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
