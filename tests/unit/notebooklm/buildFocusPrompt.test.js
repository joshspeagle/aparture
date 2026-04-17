import { describe, it, expect } from 'vitest';
import { buildFocusPrompt } from '../../../lib/notebooklm/buildFocusPrompt.js';

const briefing = {
  executiveSummary: 'Short summary.',
  themes: [
    { title: 'Interpretability', argument: 'Heads are converging.', paperIds: ['2504.01234'] },
    { title: 'Ablations', argument: 'Subset of heads matter.', paperIds: ['2504.02345'] },
  ],
  papers: [
    { arxivId: '2504.01234', title: 'Circuit-level analysis', score: 9.2 },
    { arxivId: '2504.02345', title: 'Head pruning', score: 8.5 },
  ],
};

describe('buildFocusPrompt', () => {
  it('interpolates duration, themes, and must-cite papers into the template', () => {
    const prompt = buildFocusPrompt(briefing, 20);
    expect(prompt).toContain('Target length: 20 minutes');
    expect(prompt).toContain('1. Interpretability — Heads are converging.');
    expect(prompt).toContain('2. Ablations — Subset of heads matter.');
    expect(prompt).toContain('[P1] "Circuit-level analysis" (2504.01234)');
    expect(prompt).toContain('[P2] "Head pruning" (2504.02345)');
    expect(prompt).toContain('9.2/10');
  });

  it('is truthy and non-empty even when themes/papers are absent', () => {
    const minimal = { executiveSummary: 'x', themes: [], papers: [] };
    const prompt = buildFocusPrompt(minimal, 10);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('Target length: 10 minutes');
  });

  it('describes the listener context (commute, paper-flagging) so NotebookLM gets framing', () => {
    const prompt = buildFocusPrompt(briefing, 20);
    expect(prompt.toLowerCase()).toMatch(/commute|flag|audio substitute/);
    expect(prompt).toContain('arXiv ID');
  });
});
