// Regression guard for the validation-failure RETRY body used by the four
// rubric-template routes (score-abstracts, rescore-abstracts, quick-filter,
// analyze-pdf).
//
// The retry call is ALWAYS issued uncached (`cacheable: false`), and the
// Anthropic adapter ignores `cachePrefix` whenever `cacheable === false`.
// The pre-fix code computed the retry body as
//   `useCaching ? variableTail : cachePrefix + variableTail`
// which, for live Anthropic (useCaching === true), reduced to `variableTail`
// alone — silently dropping the rubric + research profile from the very call
// that follows a validation failure. buildRetryPrompt must ALWAYS inline the
// prefix so the body is self-contained regardless of any caching flag.

import { describe, test, expect } from 'vitest';
import { buildRetryPrompt } from '../../../lib/llm/loadRubricPrompt.js';

const PREFIX = 'RUBRIC + RESEARCH PROFILE PREFIX\n';
const TAIL = 'Papers to score:\n<papers>\n';

describe('buildRetryPrompt', () => {
  test('always inlines the cache-stable prefix ahead of the variable tail', () => {
    expect(
      buildRetryPrompt({ promptOverride: undefined, cachePrefix: PREFIX, variableTail: TAIL })
    ).toBe(PREFIX + TAIL);
  });

  test('includes the prefix even in the live-Anthropic path (regression: prefix was dropped)', () => {
    // Before the fix, live Anthropic (useCaching === true) produced
    // `variableTail` alone — the rubric + profile vanished from the retry.
    // The helper takes no caching flag, so the prefix can never be dropped:
    // its presence is unconditional. Assert the rubric + profile survive.
    const body = buildRetryPrompt({
      promptOverride: undefined,
      cachePrefix: PREFIX,
      variableTail: TAIL,
    });
    expect(body).toContain(PREFIX);
    expect(body).toContain(TAIL);
    expect(body).not.toBe(TAIL); // would have been just the tail under the old bug
  });

  test('matches the old non-cached form (Google/OpenAI behavior is unchanged)', () => {
    // For Google/OpenAI the old form was `cachePrefix + variableTail`; the new
    // form equals it exactly, so those providers see no behavioral change.
    const oldNonCachedForm = PREFIX + TAIL;
    expect(
      buildRetryPrompt({ promptOverride: undefined, cachePrefix: PREFIX, variableTail: TAIL })
    ).toBe(oldNonCachedForm);
  });

  test('promptOverride fully replaces the body (fixture-hash determinism)', () => {
    const OVERRIDE = 'DETERMINISTIC TEST PROMPT';
    expect(
      buildRetryPrompt({ promptOverride: OVERRIDE, cachePrefix: PREFIX, variableTail: TAIL })
    ).toBe(OVERRIDE);
  });

  test('an empty-string promptOverride still overrides (??, not ||)', () => {
    // Nullish-coalescing means an explicit empty string is a real override,
    // not a falsy fall-through to the prefix + tail.
    expect(buildRetryPrompt({ promptOverride: '', cachePrefix: PREFIX, variableTail: TAIL })).toBe(
      ''
    );
  });

  test('byte-exact concatenation with no separator (prefix + tail invariant)', () => {
    const body = buildRetryPrompt({
      promptOverride: undefined,
      cachePrefix: PREFIX,
      variableTail: TAIL,
    });
    expect(body).toHaveLength(PREFIX.length + TAIL.length);
  });
});
