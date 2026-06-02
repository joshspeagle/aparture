import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../styles/tokens.css'), 'utf8');

// Each token must be DEFINED (name followed by a colon) in all four token
// blocks: :root, @media dark :root, [data-theme='light'], [data-theme='dark'].
const TOKENS = [
  '--aparture-surface-2',
  '--aparture-border',
  '--aparture-border-light',
  '--aparture-info-soft',
  '--aparture-info-border',
  '--aparture-info-text',
  '--aparture-text-3xl',
];

describe('design tokens are defined in all four theme blocks', () => {
  it.each(TOKENS)('%s defined exactly 4 times (once per block)', (token) => {
    // `--aparture-border\s*:` will NOT match `--aparture-border-light:`
    // (next char is `-`, not whitespace/colon), so counts stay independent.
    const count = (css.match(new RegExp(`${token}\\s*:`, 'g')) || []).length;
    expect(count).toBe(4);
  });
});
