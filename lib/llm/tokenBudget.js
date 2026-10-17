// Token estimation for pre-flight budget decisions.
//
// One char-based heuristic (~4 characters per token) for every provider.
// These are approximations used to decide whether a synthesis prompt is too
// large to send, not for cost accounting: real token counts come back on the
// provider response. A heuristic is the right tool here — Anthropic and
// Google ship no first-party JS tokenizer, and the OpenAI tokenizer package
// (a 22 MB WASM dependency) didn't know the current model ids, so it fell
// back to an older encoding anyway.

const CHARS_PER_TOKEN = 4;

/**
 * Estimate the token count for a given prompt text.
 *
 * `provider` and `model` are accepted so a per-provider tokenizer can be
 * dropped in later without touching callers; today every provider uses the
 * same ~4 chars/token heuristic.
 *
 * @param {Object} input
 * @param {'anthropic'|'openai'|'google'} [input.provider]
 * @param {string} [input.model]
 * @param {string} input.text
 * @returns {number} Estimated token count
 */
export function estimateTokens({ text }) {
  return Math.ceil((text ?? '').length / CHARS_PER_TOKEN);
}

const DEFAULT_THRESHOLDS = { notice: 150_000, block: 500_000 };

/**
 * Decide what to do given an estimated token count and budget thresholds.
 *
 * Returns one of:
 * - { action: 'proceed', estimatedTokens } — below the notice threshold
 * - { action: 'notice', estimatedTokens } — between notice and block
 * - { action: 'block', estimatedTokens } — at or above the block threshold
 *
 * @param {Object} input
 * @param {number} input.estimatedTokens
 * @param {Object} [input.thresholds] Defaults to { notice: 150_000, block: 500_000 }
 * @returns {{ action: 'proceed'|'notice'|'block', estimatedTokens: number }}
 */
export function budgetPreflight({ estimatedTokens, thresholds = DEFAULT_THRESHOLDS }) {
  if (estimatedTokens >= thresholds.block) return { action: 'block', estimatedTokens };
  if (estimatedTokens >= thresholds.notice) return { action: 'notice', estimatedTokens };
  return { action: 'proceed', estimatedTokens };
}
