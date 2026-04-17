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
  it('interpolates the duration and describes the commute/paper-flagging framing', () => {
    const prompt = buildFocusPrompt(briefing, 20);
    expect(prompt).toContain('Target length: 20 minutes');
    expect(prompt.toLowerCase()).toMatch(/commute|flag|audio substitute/);
    expect(prompt).toContain('arXiv ID');
  });

  it('points NotebookLM at the uploaded sources rather than re-enumerating them', () => {
    const prompt = buildFocusPrompt(briefing, 20);
    // Should reference the sources by name
    expect(prompt).toContain('discussion-guide.md');
    expect(prompt).toContain('briefing.md');
    // Should NOT re-enumerate theme arguments or per-paper entries
    expect(prompt).not.toContain('Heads are converging');
    expect(prompt).not.toContain('Circuit-level analysis');
    expect(prompt).not.toContain('2504.01234');
  });

  it('includes an explicit depth strategy scaled to the duration', () => {
    const shortPrompt = buildFocusPrompt(briefing, 5);
    const longPrompt = buildFocusPrompt(briefing, 30);
    // Both should mention a depth/pruning strategy
    expect(shortPrompt.toLowerCase()).toMatch(/deep-dive|deep dive|prune|drop/);
    expect(longPrompt.toLowerCase()).toMatch(/deep-dive|deep dive|prune|drop/);
    // 5-min cap should prune more aggressively than 30-min
    expect(shortPrompt).toContain('1 theme');
    expect(longPrompt).toMatch(/3-4 themes|3\s*-\s*4\s*themes/);
  });

  it('is non-empty even when themes/papers are absent (briefing arg is unused anyway)', () => {
    const minimal = { executiveSummary: 'x', themes: [], papers: [] };
    const prompt = buildFocusPrompt(minimal, 10);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('Target length: 10 minutes');
  });
});
