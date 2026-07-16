import { describe, it, expect } from 'vitest';
import {
  STAGE_TOKENS,
  STAGE_LABELS,
  PDF_TOKENS_PER_PAPER,
  BRIEFING_TOKENS,
  estimateStageCost,
  estimateRunCost,
  computeActualCost,
  formatUsd,
} from '../../../lib/analyzer/costEstimate.js';
import { MODEL_REGISTRY } from '../../../utils/models.js';

// A registry model with known pricing, used throughout. Assert the pricing
// shape here so a registry change that would invalidate the arithmetic below
// fails loudly instead of silently skewing expectations.
const PRICED_MODEL = 'claude-haiku-4.5'; // $1 in / $5 out per MTok
const ANTHROPIC_IN = MODEL_REGISTRY[PRICED_MODEL].inputPerMTok;
const ANTHROPIC_OUT = MODEL_REGISTRY[PRICED_MODEL].outputPerMTok;

describe('estimateStageCost', () => {
  it('prices a per-paper stage from the token constants and registry pricing', () => {
    const { cost, papers, model, stage } = estimateStageCost({
      stage: 'pdf',
      paperCount: 10,
      modelId: PRICED_MODEL,
    });
    const expected =
      ((PDF_TOKENS_PER_PAPER.input * 10) / 1e6) * ANTHROPIC_IN +
      ((PDF_TOKENS_PER_PAPER.output * 10) / 1e6) * ANTHROPIC_OUT;
    expect(cost).toBeCloseTo(expected, 10);
    expect(papers).toBe(10);
    expect(model).toBe(PRICED_MODEL);
    expect(stage).toBe('pdf');
  });

  it('includes the briefing base tokens (per-run, not just per-paper)', () => {
    const one = estimateStageCost({ stage: 'briefing', paperCount: 1, modelId: PRICED_MODEL });
    const baseOnly =
      (BRIEFING_TOKENS.inputBase / 1e6) * ANTHROPIC_IN +
      (BRIEFING_TOKENS.outputBase / 1e6) * ANTHROPIC_OUT;
    expect(one.cost).toBeGreaterThan(baseOnly);
  });

  it('returns null cost for a model absent from the registry', () => {
    const { cost } = estimateStageCost({
      stage: 'pdf',
      paperCount: 10,
      modelId: 'not-a-real-model',
    });
    expect(cost).toBeNull();
  });

  it('returns null cost for an unknown stage or a zero/invalid paper count', () => {
    expect(
      estimateStageCost({ stage: 'nope', paperCount: 5, modelId: PRICED_MODEL }).cost
    ).toBeNull();
    expect(
      estimateStageCost({ stage: 'pdf', paperCount: 0, modelId: PRICED_MODEL }).cost
    ).toBeNull();
    expect(
      estimateStageCost({ stage: 'pdf', paperCount: NaN, modelId: PRICED_MODEL }).cost
    ).toBeNull();
  });
});

describe('estimateRunCost', () => {
  const config = {
    filterModel: PRICED_MODEL,
    scoringModel: PRICED_MODEL,
    pdfModel: PRICED_MODEL,
    briefingModel: PRICED_MODEL,
  };

  it('sums the included stages and reports them in byStage', () => {
    const { total, byStage, hasUnknownPricing } = estimateRunCost({
      counts: { filter: 100, scoring: 50, pdf: 10 },
      config,
    });
    expect(byStage).toHaveLength(3);
    expect(byStage.map((s) => s.stage)).toEqual(['filter', 'scoring', 'pdf']);
    const summed = byStage.reduce((acc, s) => acc + s.cost, 0);
    expect(total).toBeCloseTo(summed, 10);
    expect(hasUnknownPricing).toBe(false);
  });

  it('skips stages with zero or missing counts', () => {
    const { byStage } = estimateRunCost({ counts: { filter: 0, pdf: 5 }, config });
    expect(byStage.map((s) => s.stage)).toEqual(['pdf']);
  });

  it('null-prices a stage whose model is unknown and flags hasUnknownPricing', () => {
    const { total, byStage, hasUnknownPricing } = estimateRunCost({
      counts: { filter: 10, pdf: 5 },
      config: { ...config, filterModel: 'mystery-model' },
    });
    const filterEntry = byStage.find((s) => s.stage === 'filter');
    expect(filterEntry.cost).toBeNull();
    expect(hasUnknownPricing).toBe(true);
    // The priced stage still contributes to the total.
    const pdfEntry = byStage.find((s) => s.stage === 'pdf');
    expect(total).toBeCloseTo(pdfEntry.cost, 10);
  });

  it('returns a null total when no included stage can be priced', () => {
    const { total, hasUnknownPricing } = estimateRunCost({
      counts: { filter: 10 },
      config: { filterModel: 'mystery-model' },
    });
    expect(total).toBeNull();
    expect(hasUnknownPricing).toBe(true);
  });

  it('quick summaries and briefing fall back to briefingModel then pdfModel', () => {
    const { byStage } = estimateRunCost({
      counts: { quickSummary: 5, briefing: 5 },
      config: { pdfModel: PRICED_MODEL },
    });
    expect(byStage.every((s) => s.model === PRICED_MODEL)).toBe(true);
    expect(byStage.every((s) => s.cost != null)).toBe(true);
  });
});

describe('computeActualCost', () => {
  it('prices accumulated usage per stage and sums the total', () => {
    const { total, byStage, hasUnknownPricing, hasUsage } = computeActualCost({
      filter: { model: PRICED_MODEL, tokensIn: 1_000_000, tokensOut: 100_000, cacheReadTok: 0 },
      pdf: { model: PRICED_MODEL, tokensIn: 2_000_000, tokensOut: 200_000, cacheReadTok: 0 },
    });
    expect(hasUsage).toBe(true);
    expect(hasUnknownPricing).toBe(false);
    expect(byStage.map((s) => s.stage)).toEqual(['filter', 'pdf']);
    const expected =
      1 * ANTHROPIC_IN +
      0.1 * ANTHROPIC_OUT + // filter
      2 * ANTHROPIC_IN +
      0.2 * ANTHROPIC_OUT; // pdf
    expect(total).toBeCloseTo(expected, 10);
  });

  it('bills Anthropic cache reads at one-tenth the input rate', () => {
    const base = computeActualCost({
      scoring: { model: PRICED_MODEL, tokensIn: 1_000_000, tokensOut: 0, cacheReadTok: 0 },
    });
    const withCache = computeActualCost({
      scoring: {
        model: PRICED_MODEL,
        tokensIn: 1_000_000,
        tokensOut: 0,
        cacheReadTok: 1_000_000,
      },
    });
    expect(withCache.total - base.total).toBeCloseTo(ANTHROPIC_IN * 0.1, 10);
  });

  it('does not add a cache-read surcharge for non-Anthropic models (already in tokensIn)', () => {
    const openaiModel = 'gpt-5.4-nano';
    const base = computeActualCost({
      scoring: { model: openaiModel, tokensIn: 1_000_000, tokensOut: 0, cacheReadTok: 0 },
    });
    const withCache = computeActualCost({
      scoring: {
        model: openaiModel,
        tokensIn: 1_000_000,
        tokensOut: 0,
        cacheReadTok: 500_000,
      },
    });
    expect(withCache.total).toBeCloseTo(base.total, 10);
  });

  it('marks unknown-priced stages, omits them from the total, keeps them out of cost', () => {
    const { total, byStage, hasUnknownPricing } = computeActualCost({
      filter: { model: 'mystery-model', tokensIn: 500, tokensOut: 100, cacheReadTok: 0 },
      pdf: { model: PRICED_MODEL, tokensIn: 1_000_000, tokensOut: 0, cacheReadTok: 0 },
    });
    expect(hasUnknownPricing).toBe(true);
    expect(byStage.find((s) => s.stage === 'filter').cost).toBeNull();
    expect(total).toBeCloseTo(ANTHROPIC_IN, 10);
  });

  it('reports no usage for an empty run (dry runs record nothing)', () => {
    const { total, byStage, hasUsage } = computeActualCost({});
    expect(hasUsage).toBe(false);
    expect(total).toBeNull();
    expect(byStage).toEqual([]);
  });

  it('skips stages whose accumulated usage is all zeros', () => {
    const { hasUsage, byStage } = computeActualCost({
      filter: { model: PRICED_MODEL, tokensIn: 0, tokensOut: 0, cacheReadTok: 0 },
    });
    expect(hasUsage).toBe(false);
    expect(byStage).toEqual([]);
  });
});

describe('formatUsd', () => {
  it('formats at cents precision', () => {
    expect(formatUsd(0.034)).toBe('$0.03');
    expect(formatUsd(1.875)).toBe('$1.88');
    expect(formatUsd(12)).toBe('$12.00');
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('renders tiny positive amounts as "< $0.01" instead of $0.00', () => {
    expect(formatUsd(0.001)).toBe('< $0.01');
  });

  it('returns an empty string for non-finite input', () => {
    expect(formatUsd(null)).toBe('');
    expect(formatUsd(NaN)).toBe('');
    expect(formatUsd(undefined)).toBe('');
  });
});

describe('stage tables', () => {
  it('every stage in STAGE_TOKENS has a display label', () => {
    for (const stage of Object.keys(STAGE_TOKENS)) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});
