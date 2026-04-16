import { describe, it, expect } from 'vitest';
import { renderSynthesisPrompt } from '../../../lib/synthesis/renderPrompt.js';

describe('renderSynthesisPrompt', () => {
  it('substitutes profile and papers', () => {
    const template = 'profile={{profile}}\npapers={{papers}}';
    const rendered = renderSynthesisPrompt(template, {
      profile: 'I study X.',
      papers: [{ arxivId: '1', title: 't' }],
    });
    expect(rendered).toContain('profile=I study X.');
    expect(rendered).toContain('"arxivId": "1"');
  });

  it('throws if template is missing required slots', () => {
    expect(() =>
      renderSynthesisPrompt('profile={{profile}}', {
        profile: 'x',
        papers: [],
      })
    ).toThrow(/missing template slot/i);
  });
});
