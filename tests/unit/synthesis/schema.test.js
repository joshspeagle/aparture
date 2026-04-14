import { describe, it, expect } from 'vitest';
import { BriefingSchema, toJsonSchema } from '../../../lib/synthesis/schema.js';

describe('BriefingSchema', () => {
  it('accepts a well-formed briefing', () => {
    const briefing = {
      executiveSummary: 'Today in ML, three threads converge on interpretability.',
      themes: [
        {
          title: 'Interpretability converges on attention heads',
          argument: 'Two papers tighten the attention-head-level analysis story.',
          paperIds: ['2504.01234', '2504.02345'],
        },
      ],
      papers: [
        {
          arxivId: '2504.01234',
          title: 'Circuit-level analysis of reasoning',
          score: 9.2,
          onelinePitch:
            'A mechanistic account of how attention heads compose into reasoning steps.',
          whyMatters: 'Grounded in your stated interest in mechanistic interpretability.',
          figures: [],
          quickSummaryPath: 'reports/2026-04-13/papers/2504.01234-quick.md',
          fullReportPath: 'reports/2026-04-13/papers/2504.01234-full.md',
        },
        {
          arxivId: '2504.02345',
          title: 'Head pruning ablations',
          score: 8.5,
          onelinePitch:
            'Ablation evidence that only a small subset of attention heads matter for task X.',
          whyMatters: 'Directly tests the framing from your March 3 starred paper.',
          figures: [],
          quickSummaryPath: 'reports/2026-04-13/papers/2504.02345-quick.md',
          fullReportPath: 'reports/2026-04-13/papers/2504.02345-full.md',
        },
      ],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    const result = BriefingSchema.safeParse(briefing);
    expect(result.success).toBe(true);
  });

  it('rejects a briefing with a missing required field', () => {
    const briefing = { themes: [], papers: [] }; // missing executiveSummary
    const result = BriefingSchema.safeParse(briefing);
    expect(result.success).toBe(false);
  });
});

describe('toJsonSchema', () => {
  it('emits a JSON schema for provider-native structured output', () => {
    const schema = toJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties.executiveSummary).toBeDefined();
    expect(schema.properties.themes).toBeDefined();
    expect(schema.properties.papers).toBeDefined();
  });
});
