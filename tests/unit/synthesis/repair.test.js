import { describe, it, expect, vi } from 'vitest';
import { repairBriefing } from '../../../lib/synthesis/repair.js';

describe('repairBriefing', () => {
  it('returns the original if validation passes', async () => {
    const briefing = {
      executiveSummary: 'ok',
      themes: [{ title: 't', argument: 'a', paperIds: ['p1'] }],
      papers: [
        {
          arxivId: 'p1',
          title: 'x',
          score: 5,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
      ],
    };
    const callModel = vi.fn();
    const result = await repairBriefing({
      briefing,
      inputPaperIds: ['p1'],
      callModel,
    });
    expect(result.briefing).toEqual(briefing);
    expect(result.repaired).toBe(false);
    expect(callModel).not.toHaveBeenCalled();
  });

  it('asks the model to repair when validation fails', async () => {
    const brokenBriefing = {
      executiveSummary: 'ok',
      themes: [],
      papers: [
        {
          arxivId: 'p-wrong',
          title: 'x',
          score: 5,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
      ],
    };
    const fixedBriefing = {
      ...brokenBriefing,
      papers: [{ ...brokenBriefing.papers[0], arxivId: 'p1' }],
    };
    const callModel = vi.fn().mockResolvedValue({
      structured: fixedBriefing,
      text: '',
      tokensIn: 0,
      tokensOut: 0,
    });
    const result = await repairBriefing({
      briefing: brokenBriefing,
      inputPaperIds: ['p1'],
      callModel,
      llmConfig: { provider: 'anthropic', model: 'claude-opus-4-7', apiKey: 'k' },
    });
    expect(result.repaired).toBe(true);
    expect(result.briefing.papers[0].arxivId).toBe('p1');
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('throws if repair still fails validation', async () => {
    const brokenBriefing = {
      executiveSummary: 'ok',
      themes: [],
      papers: [
        {
          arxivId: 'still-wrong',
          title: 'x',
          score: 5,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
      ],
    };
    const callModel = vi.fn().mockResolvedValue({
      structured: brokenBriefing,
      text: '',
      tokensIn: 0,
      tokensOut: 0,
    });
    await expect(
      repairBriefing({
        briefing: brokenBriefing,
        inputPaperIds: ['p1'],
        callModel,
        llmConfig: { provider: 'anthropic', model: 'claude-opus-4-7', apiKey: 'k' },
      })
    ).rejects.toThrow(/repair failed/i);
  });
});
