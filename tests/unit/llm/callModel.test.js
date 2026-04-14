import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callModel } from '../../../lib/llm/callModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../fixtures/llm');

describe('callModel', () => {
  it('returns cached response in fixture mode', async () => {
    const result = await callModel(
      { provider: 'anthropic', model: 'test-model', prompt: 'hi' },
      { mode: 'fixture', fixturesDir }
    );
    expect(result.text).toBe('hello from fixture');
  });

  it('throws in fixture mode when no fixture exists', async () => {
    await expect(
      callModel(
        { provider: 'anthropic', model: 'test-model', prompt: 'nonexistent' },
        { mode: 'fixture', fixturesDir }
      )
    ).rejects.toThrow(/no fixture/i);
  });

  it('rejects unknown providers', async () => {
    await expect(
      callModel({ provider: 'bogus', model: 'x', prompt: 'y' }, { mode: 'fixture', fixturesDir })
    ).rejects.toThrow(/unknown provider/i);
  });
});
