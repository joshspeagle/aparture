import { describe, it, expect } from 'vitest';
import { estimateTokens, budgetPreflight } from '../../../lib/llm/tokenBudget.js';

describe('estimateTokens', () => {
  it('uses a ~4 chars/token heuristic for every provider', () => {
    const text = 'a'.repeat(400);
    for (const [provider, model] of [
      ['anthropic', 'claude-sonnet-5.5'],
      ['google', 'gemini-3.8-flash'],
      ['openai', 'gpt-6.1-sol'],
    ]) {
      expect(estimateTokens({ provider, model, text })).toBe(100);
    }
  });

  it('rounds up partial tokens', () => {
    expect(estimateTokens({ provider: 'openai', model: 'gpt-6-luna', text: 'hello' })).toBe(2);
  });

  it('treats missing text as zero tokens', () => {
    expect(estimateTokens({ provider: 'anthropic', model: 'claude-haiku-5.5' })).toBe(0);
  });
});

describe('budgetPreflight', () => {
  it('returns "proceed" below the low threshold', () => {
    const result = budgetPreflight({ estimatedTokens: 1000 });
    expect(result.action).toBe('proceed');
  });

  it('returns "notice" between 150k and 500k', () => {
    const result = budgetPreflight({ estimatedTokens: 200_000 });
    expect(result.action).toBe('notice');
  });

  it('returns "block" above 500k', () => {
    const result = budgetPreflight({ estimatedTokens: 600_000 });
    expect(result.action).toBe('block');
  });

  it('honors custom thresholds', () => {
    const result = budgetPreflight({
      estimatedTokens: 50_000,
      thresholds: { notice: 10_000, block: 100_000 },
    });
    expect(result.action).toBe('notice');
  });
});
