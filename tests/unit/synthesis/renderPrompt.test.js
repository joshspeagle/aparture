import { describe, it, expect } from 'vitest';
import { renderSynthesisPrompt } from '../../../lib/synthesis/renderPrompt.js';

describe('renderSynthesisPrompt', () => {
  it('substitutes profile, papers, and history', () => {
    const template = 'profile={{profile}}\npapers={{papers}}\nhistory={{history}}';
    const rendered = renderSynthesisPrompt(template, {
      profile: 'I study X.',
      papers: [{ arxivId: '1', title: 't' }],
      history: [],
    });
    expect(rendered).toContain('profile=I study X.');
    expect(rendered).toContain('"arxivId": "1"');
    expect(rendered).toContain('history=[]');
  });

  it('throws if template is missing required slots', () => {
    expect(() =>
      renderSynthesisPrompt('profile={{profile}}', {
        profile: 'x',
        papers: [],
        history: [],
      })
    ).toThrow(/missing template slot/i);
  });
});
