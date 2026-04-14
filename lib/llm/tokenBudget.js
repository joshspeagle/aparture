// Token estimation with per-provider strategies.
//
// - OpenAI: use tiktoken (cl100k_base or model-specific encoding) for accuracy.
// - Anthropic / Google: use a char-based heuristic (~4 chars/token) since
//   neither provider ships a first-party JS tokenizer.
//
// These are approximations used for pre-flight budget decisions, not for
// cost accounting. Real token counts come from the provider response.

import { encoding_for_model, get_encoding } from 'tiktoken';

/**
 * Estimate the token count for a given prompt text under a given provider/model.
 *
 * For OpenAI, uses the official tiktoken encoder (model-specific if available,
 * otherwise cl100k_base). For Anthropic and Google, uses a char-based
 * heuristic of ~4 characters per token.
 *
 * @param {Object} input
 * @param {'anthropic'|'openai'|'google'} input.provider
 * @param {string} input.model
 * @param {string} input.text
 * @returns {number} Estimated token count
 */
export function estimateTokens({ provider, model, text }) {
  if (provider === 'openai') {
    let enc;
    try {
      enc = encoding_for_model(model);
    } catch {
      enc = get_encoding('cl100k_base');
    }
    const tokens = enc.encode(text).length;
    enc.free?.();
    return tokens;
  }
  // Char-based heuristic for Anthropic and Google: ~4 chars per token
  return Math.ceil(text.length / 4);
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
