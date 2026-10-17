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
  it('states the preset and its range and describes the commute/paper-flagging framing', () => {
    const prompt = buildFocusPrompt(briefing, 'default');
    expect(prompt).toContain('Target length: Default, about 10–15 minutes');
    expect(prompt).toContain('1,500–2,250 words');
    expect(prompt.toLowerCase()).toMatch(/commute|flag|audio substitute/);
    expect(prompt).toContain('arXiv ID');
  });

  it('points the notebook at the uploaded sources rather than re-enumerating them', () => {
    const prompt = buildFocusPrompt(briefing, 'default');
    expect(prompt).toContain('discussion-guide.md');
    expect(prompt).toContain('briefing.md');
    expect(prompt).not.toContain('Heads are converging');
    expect(prompt).not.toContain('Circuit-level analysis');
    expect(prompt).not.toContain('2504.01234');
  });

  it('scales the depth strategy to the preset', () => {
    const shortPrompt = buildFocusPrompt(briefing, 'short');
    const longPrompt = buildFocusPrompt(briefing, 'long');
    expect(shortPrompt).toContain('1-2 themes');
    expect(shortPrompt).toContain('below 8/10');
    expect(longPrompt).toContain('3-4 themes');
    expect(longPrompt).toContain('Target length: Long, about 20–30 minutes');
  });

  it('maps a minute count from an older session onto a preset', () => {
    expect(buildFocusPrompt(briefing, 5)).toBe(buildFocusPrompt(briefing, 'short'));
    expect(buildFocusPrompt(briefing, 20)).toBe(buildFocusPrompt(briefing, 'default'));
    expect(buildFocusPrompt(briefing, 30)).toBe(buildFocusPrompt(briefing, 'long'));
  });
});
