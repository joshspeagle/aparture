import { describe, it, expect } from 'vitest';
import { estimateTokens, budgetPreflight } from '../../../lib/llm/tokenBudget.js';

describe('estimateTokens', () => {
  it('uses tiktoken for OpenAI', () => {
    const n = estimateTokens({ provider: 'openai', model: 'gpt-5.2', text: 'hello world' });
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(10);
  });

  it('uses char-based heuristic for Anthropic', () => {
    const text = 'a'.repeat(400);
    const n = estimateTokens({ provider: 'anthropic', model: 'claude-opus-4-6', text });
    // ~4 chars per token heuristic
    expect(n).toBeGreaterThan(80);
    expect(n).toBeLessThan(120);
  });

  it('uses char-based heuristic for Google', () => {
    const text = 'a'.repeat(400);
    const n = estimateTokens({ provider: 'google', model: 'gemini-2.5-flash', text });
    expect(n).toBeGreaterThan(80);
    expect(n).toBeLessThan(120);
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
