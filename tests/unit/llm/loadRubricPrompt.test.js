// Verifies the rubric-prompt loader:
//   1. Splits on {{CACHE_BOUNDARY}} and substitutes vars into the correct half
//   2. Preserves the byte-exact invariant (cachePrefix + tail === fullPrompt)
//   3. Throws a clear error when the marker is missing
//   4. Handles multiple substitutions per variable
//   5. Reads from the real prompts/ directory

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadRubricPrompt } from '../../../lib/llm/loadRubricPrompt.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'prompts');
const TEST_FILES = [
  '__test_rubric_basic.md',
  '__test_rubric_no_marker.md',
  '__test_rubric_multi.md',
];

async function writeTestFile(name, content) {
  await fs.writeFile(path.resolve(FIXTURES_DIR, name), content, 'utf8');
}

describe('loadRubricPrompt', () => {
  beforeAll(async () => {
    await writeTestFile(
      '__test_rubric_basic.md',
      'Rubric prefix for {{profile}}.\nAnother prefix line.\n\n{{CACHE_BOUNDARY}}\n\nVariable tail with {{papers}}.\n'
    );
    await writeTestFile('__test_rubric_no_marker.md', 'Rubric with no marker here.\n{{profile}}\n');
    await writeTestFile(
      '__test_rubric_multi.md',
      'First {{x}}, second {{x}}, third {{x}}.\n\n{{CACHE_BOUNDARY}}\n\nTail {{y}} once.\n'
    );
  });

  afterAll(async () => {
    for (const name of TEST_FILES) {
      try {
        await fs.unlink(path.resolve(FIXTURES_DIR, name));
      } catch {
        // already gone
      }
    }
  });

  test('splits at the marker and substitutes stable + variable vars separately', async () => {
    const { cachePrefix, variableTail, fullPrompt } = await loadRubricPrompt(
      '__test_rubric_basic.md',
      { profile: 'alice' },
      { papers: 'paper-one' }
    );

    expect(cachePrefix).toBe('Rubric prefix for alice.\nAnother prefix line.');
    expect(variableTail).toBe('Variable tail with paper-one.\n');
    expect(fullPrompt).toBe(cachePrefix + variableTail);
  });

  test('preserves the byte-exact invariant: cachePrefix + variableTail === fullPrompt', async () => {
    const { cachePrefix, variableTail, fullPrompt } = await loadRubricPrompt(
      '__test_rubric_basic.md',
      { profile: 'profile-text\nwith\nnewlines' },
      { papers: 'papers-text' }
    );

    expect(cachePrefix + variableTail).toBe(fullPrompt);
    expect(cachePrefix + variableTail).toHaveLength(fullPrompt.length);
  });

  test('throws a clear error when the marker is missing', async () => {
    await expect(loadRubricPrompt('__test_rubric_no_marker.md', { profile: 'x' })).rejects.toThrow(
      /missing \{\{CACHE_BOUNDARY\}\} marker/
    );
  });

  test('substitutes every occurrence of a variable on the correct side only', async () => {
    const { cachePrefix, variableTail } = await loadRubricPrompt(
      '__test_rubric_multi.md',
      { x: 'ALPHA' },
      { y: 'BETA' }
    );

    expect(cachePrefix).toBe('First ALPHA, second ALPHA, third ALPHA.');
    expect(variableTail).toBe('Tail BETA once.\n');
  });

  test('variables in the wrong half are left unsubstituted', async () => {
    // x is declared as stable; passing it in variableVars shouldn't substitute.
    // y is declared as variable; passing it in stableVars shouldn't substitute.
    const { cachePrefix, variableTail } = await loadRubricPrompt(
      '__test_rubric_multi.md',
      { y: 'should-not-appear' },
      { x: 'should-not-appear' }
    );

    expect(cachePrefix).toContain('{{x}}');
    expect(cachePrefix).not.toContain('should-not-appear');
    expect(variableTail).toContain('{{y}}');
    expect(variableTail).not.toContain('should-not-appear');
  });

  test('reads the shipped rubric-scoring.md file and splits correctly', async () => {
    const { cachePrefix, variableTail, fullPrompt } = await loadRubricPrompt(
      'rubric-scoring.md',
      { profile: 'TEST_PROFILE' },
      { papers: 'TEST_PAPERS' }
    );

    expect(cachePrefix).toContain('scoring academic paper abstracts');
    expect(cachePrefix).toContain('TEST_PROFILE');
    expect(cachePrefix).not.toContain('TEST_PAPERS');
    expect(variableTail).toContain('TEST_PAPERS');
    expect(variableTail).toContain('Papers to score:');
    expect(fullPrompt).toBe(cachePrefix + variableTail);
  });

  // Regression guard: verifies that every shipped rubric places `{{profile}}`
  // on the cache-stable side of the boundary, and the per-batch variable
  // content (papers, originalScore) on the variable side. Catches a future
  // edit that accidentally moves the {{profile}} placeholder below the
  // boundary — which would break Anthropic prompt caching even though the
  // byte-exact invariant still holds.
  test.each([
    { file: 'rubric-filter.md', varKey: 'papers', varValue: 'PAPERS_MARKER' },
    { file: 'rubric-scoring.md', varKey: 'papers', varValue: 'PAPERS_MARKER' },
    { file: 'rubric-rescoring.md', varKey: 'papers', varValue: 'PAPERS_MARKER' },
    { file: 'rubric-pdf.md', varKey: 'originalScore', varValue: 'SCORE_MARKER' },
  ])(
    '$file: profile lands in cachePrefix, variable vars land in variableTail',
    async ({ file, varKey, varValue }) => {
      const { cachePrefix, variableTail } = await loadRubricPrompt(
        file,
        { profile: 'PROFILE_MARKER' },
        { [varKey]: varValue }
      );

      expect(cachePrefix).toContain('PROFILE_MARKER');
      expect(cachePrefix).not.toContain(varValue);
      expect(variableTail).toContain(varValue);
      expect(variableTail).not.toContain('PROFILE_MARKER');
    }
  );
});
