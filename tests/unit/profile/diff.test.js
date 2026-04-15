import { describe, it, expect } from 'vitest';
import { diffWords } from '../../../lib/profile/diff.js';

describe('diffWords', () => {
  it('returns unchanged tokens when strings match', () => {
    const tokens = diffWords('hello world', 'hello world');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('unchanged');
    expect(tokens[0].text).toBe('hello world');
  });

  it('identifies added words', () => {
    const tokens = diffWords('hello', 'hello world');
    const added = tokens.filter((t) => t.type === 'added');
    expect(added.map((t) => t.text.trim()).filter(Boolean)).toContain('world');
  });

  it('identifies removed words', () => {
    const tokens = diffWords('hello world', 'hello');
    const removed = tokens.filter((t) => t.type === 'removed');
    expect(removed.map((t) => t.text.trim()).filter(Boolean)).toContain('world');
  });

  it('handles mixed add/remove in one diff', () => {
    const tokens = diffWords('I study flows', 'I study mechanistic interpretability');
    const added = tokens
      .filter((t) => t.type === 'added')
      .map((t) => t.text)
      .join('');
    const removed = tokens
      .filter((t) => t.type === 'removed')
      .map((t) => t.text)
      .join('');
    expect(added).toMatch(/mechanistic/);
    expect(removed).toMatch(/flows/);
  });

  it('returns an empty array for two empty strings', () => {
    expect(diffWords('', '')).toEqual([]);
  });
});
