import { describe, it, expect } from 'vitest';
import { stripCodeFence } from '../../../pages/api/generate-notebooklm.js';

describe('stripCodeFence', () => {
  it('strips a leading ```markdown fence and trailing ``` fence', () => {
    const input = '```markdown\n# Outline\n\nAct 1...\n```\n';
    const out = stripCodeFence(input);
    expect(out).toBe('# Outline\n\nAct 1...\n');
  });

  it('strips a leading bare ``` fence (no language tag)', () => {
    const input = '```\n# Outline\n```\n';
    const out = stripCodeFence(input);
    expect(out).toBe('# Outline\n');
  });

  it('strips a leading ```md fence', () => {
    const input = '```md\n# Outline\n```';
    expect(stripCodeFence(input)).toBe('# Outline\n');
  });

  it('passes through text that is not fence-wrapped', () => {
    const input = '# Outline\n\nAct 1...\n';
    expect(stripCodeFence(input)).toBe(input);
  });

  it('leaves inline code fences inside the body alone', () => {
    const input = '# Outline\n\nCode example:\n```js\nfoo();\n```\n\nMore text.\n';
    expect(stripCodeFence(input)).toBe(input);
  });

  it('does not strip if only the opening fence is present', () => {
    const input = '```markdown\n# Outline with no closing fence\n';
    expect(stripCodeFence(input)).toBe(input);
  });
});
