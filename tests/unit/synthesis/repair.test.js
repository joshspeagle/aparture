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
      themes: [{ title: 't', argument: 'a', paperIds: ['p-wrong'] }],
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
      themes: [{ title: 't', argument: 'a', paperIds: ['p1'] }],
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

  it('carries the failed candidate and its token usage on the error, for salvage', async () => {
    const broken = {
      executiveSummary: 'ok',
      themes: [],
      papers: [{ arxivId: 'p1', title: 'x', score: 5, onelinePitch: 'p', whyMatters: 'w' }],
    };
    const callModel = vi
      .fn()
      .mockResolvedValue({ structured: broken, text: '', tokensIn: 120, tokensOut: 340 });
    let caught;
    try {
      await repairBriefing({
        briefing: broken,
        inputPaperIds: ['p1'],
        callModel,
        llmConfig: { provider: 'anthropic', model: 'm', apiKey: 'k' },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught.briefing).toEqual(broken);
    expect(caught.validationErrors.some((e) => /not in any theme/.test(e))).toBe(true);
    expect(caught.tokensIn).toBe(120);
    expect(caught.tokensOut).toBe(340);
  });

  it("shows the model each paper's title and the source of papers that need a new card", async () => {
    const input = [
      { arxivId: '2610.00001', title: 'Conditional Mean Flows', score: 8 },
      {
        arxivId: '2610.00002',
        title: 'An Attenuation Bump',
        score: 7,
        abstract: 'We report a UV bump at z = 9.3.',
        scoringJustification: 'Matches the dust interest.',
        fullReport: '## Summary\n\nA bump.',
        engagement: { starred: true, dismissed: false },
      },
    ];
    const briefing = {
      executiveSummary: 'ok',
      themes: [{ title: 't', argument: 'a', paperIds: ['2610.00001'] }],
      papers: [
        {
          arxivId: '2610.00001',
          title: 'Conditional Mean Flows',
          score: 8,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
      ],
    };
    const fixed = {
      ...briefing,
      themes: [{ title: 't', argument: 'a', paperIds: ['2610.00001', '2610.00002'] }],
      papers: [
        ...briefing.papers,
        {
          arxivId: '2610.00002',
          title: 'An Attenuation Bump',
          score: 7,
          onelinePitch: 'p',
          whyMatters: 'w',
        },
      ],
    };
    const callModel = vi.fn().mockResolvedValue({ structured: fixed, text: '' });

    const result = await repairBriefing({
      briefing,
      inputPapers: input,
      callModel,
      llmConfig: { provider: 'anthropic', model: 'm', apiKey: 'k' },
    });

    expect(result.repaired).toBe(true);
    const prompt = callModel.mock.calls[0][0].prompt;
    expect(prompt).toContain('- 2610.00001 — "Conditional Mean Flows"');
    expect(prompt).toContain('- 2610.00002 — "An Attenuation Bump" [starred]');
    expect(prompt).toContain('starred paper "2610.00002" has no card');
    expect(prompt).toContain('Abstract: We report a UV bump at z = 9.3.');
    expect(prompt).toContain('Scoring note: Matches the dust interest.');
    expect(prompt).toContain('## Summary\n\nA bump.');
  });
});
