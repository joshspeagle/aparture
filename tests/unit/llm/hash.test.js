import { describe, it, expect } from 'vitest';
import { hashInput } from '../../../lib/llm/hash.js';

describe('hashInput', () => {
  it('produces a deterministic hex string', () => {
    const input = { provider: 'anthropic', model: 'claude-opus-4-6', prompt: 'hello' };
    const h1 = hashInput(input);
    const h2 = hashInput(input);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{16,}$/);
  });

  it('is order-insensitive for object keys', () => {
    const a = hashInput({ model: 'x', prompt: 'y', provider: 'z' });
    const b = hashInput({ provider: 'z', prompt: 'y', model: 'x' });
    expect(a).toBe(b);
  });

  it('changes when any field changes', () => {
    const base = hashInput({ provider: 'a', model: 'b', prompt: 'c' });
    expect(hashInput({ provider: 'a', model: 'b', prompt: 'd' })).not.toBe(base);
    expect(hashInput({ provider: 'a', model: 'x', prompt: 'c' })).not.toBe(base);
    expect(hashInput({ provider: 'x', model: 'b', prompt: 'c' })).not.toBe(base);
  });
});
