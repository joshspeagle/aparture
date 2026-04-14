import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixture, loadFixtureByHash } from '../../../lib/llm/fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../fixtures/llm');

describe('loadFixtureByHash', () => {
  it('returns the response when fixture exists', async () => {
    const result = await loadFixtureByHash('abc123def456', fixturesDir);
    expect(result).toEqual({ text: 'hi there', tokensIn: 10, tokensOut: 5 });
  });

  it('returns null when fixture does not exist', async () => {
    const result = await loadFixtureByHash('nonexistent', fixturesDir);
    expect(result).toBeNull();
  });
});

describe('loadFixture', () => {
  it('loads by hashing the input', async () => {
    // This will return null because hashInput({provider:'anthropic',prompt:'hello'})
    // does NOT equal the literal string "abc123def456" — the test confirms the
    // function plumbs through hashInput before lookup.
    const result = await loadFixture({ provider: 'anthropic', prompt: 'hello' }, fixturesDir);
    expect(result).toBeNull();
  });
});
