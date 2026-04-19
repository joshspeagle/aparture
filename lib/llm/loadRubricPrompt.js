// lib/llm/loadRubricPrompt.js
//
// Load a scoring-rubric prompt file and split it into the stable
// cache-prefix and the variable tail used by callModel's Anthropic
// cache-control mechanism. The file must contain a line with
// {{CACHE_BOUNDARY}} (with blank lines before and after) marking the
// point where the stable prefix ends and the variable tail begins.
//
// Invariant: cachePrefix + variableTail === fullPrompt, byte-for-byte.
// This keeps Anthropic prompt-cache reads/writes aligned and keeps
// fixture-hash determinism stable.

import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_BOUNDARY = '{{CACHE_BOUNDARY}}';
// Splits on the marker line plus its surrounding blank lines so the
// resulting halves join with no separator — matching the byte layout
// of the pre-refactor embedded buildCachePrefix + buildBatchPrompt.
const BOUNDARY_SPLIT = /\n\n\{\{CACHE_BOUNDARY\}\}\n\n/;

/**
 * Load a rubric prompt, substitute template variables, and return the
 * two halves ready for callModel.
 *
 * @param {string} filename - file basename under prompts/ (e.g. 'rubric-scoring.md')
 * @param {Record<string, string>} [stableVars] - substituted into the prefix (e.g. {profile: '...'})
 * @param {Record<string, string>} [variableVars] - substituted into the tail (e.g. {papers: '...'})
 * @returns {Promise<{cachePrefix: string, variableTail: string, fullPrompt: string}>}
 */
export async function loadRubricPrompt(filename, stableVars = {}, variableVars = {}) {
  const templatePath = path.resolve(process.cwd(), 'prompts', filename);
  const raw = await fs.readFile(templatePath, 'utf8');
  // Normalize Windows line endings so the split regex and byte-exactness
  // behave identically across platforms.
  const template = raw.replace(/\r\n/g, '\n');

  if (!template.includes(CACHE_BOUNDARY)) {
    throw new Error(
      `loadRubricPrompt(${filename}): missing ${CACHE_BOUNDARY} marker. ` +
        `Rubric templates must contain "\\n\\n{{CACHE_BOUNDARY}}\\n\\n" on its own line ` +
        `between the stable rubric prefix and the variable tail.`
    );
  }

  const parts = template.split(BOUNDARY_SPLIT);
  if (parts.length !== 2) {
    throw new Error(
      `loadRubricPrompt(${filename}): expected exactly one {{CACHE_BOUNDARY}} marker on its own ` +
        `line with blank lines above and below; found ${parts.length - 1}.`
    );
  }

  const [rawPrefix, rawTail] = parts;
  const cachePrefix = substitute(rawPrefix, stableVars);
  const variableTail = substitute(rawTail, variableVars);

  return {
    cachePrefix,
    variableTail,
    fullPrompt: cachePrefix + variableTail,
  };
}

function substitute(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g');
    out = out.replace(pattern, String(value ?? ''));
  }
  return out;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
