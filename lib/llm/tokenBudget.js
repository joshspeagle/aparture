// Token estimation with per-provider strategies.
//
// - OpenAI: use tiktoken (cl100k_base or model-specific encoding) for accuracy.
// - Anthropic / Google: use a char-based heuristic (~4 chars/token) since
//   neither provider ships a first-party JS tokenizer.
//
// These are approximations used for pre-flight budget decisions, not for
// cost accounting. Real token counts come from the provider response.

import { encoding_for_model, get_encoding } from 'tiktoken';

// Per-model encoder memo. tiktoken encoders are WASM-backed and expensive to
// construct — the old per-call construct/free cycle rebuilt one per
// synthesize request (and leaked the WASM allocation whenever encode threw
// before the free). Memoized encoders are intentionally never freed: one
// lives per distinct model id for the process lifetime, bounded by the
// registry. Unknown model ids alias the shared cl100k_base fallback so the
// encoding_for_model throw is paid once per id, not per call.
const encoderCache = new Map();
const FALLBACK_KEY = '__cl100k_base__';

function getEncoderForModel(model) {
  const key = String(model);
  let enc = encoderCache.get(key);
  if (enc) return enc;
  try {
    enc = encoding_for_model(model);
  } catch {
    enc = encoderCache.get(FALLBACK_KEY) ?? get_encoding('cl100k_base');
    encoderCache.set(FALLBACK_KEY, enc);
  }
  encoderCache.set(key, enc);
  return enc;
}

/**
 * Estimate the token count for a given prompt text under a given provider/model.
 *
 * For OpenAI, uses the official tiktoken encoder (model-specific if available,
 * otherwise cl100k_base — unknown model ids fall back without throwing). For
 * Anthropic and Google, uses a char-based heuristic of ~4 characters per token.
 *
 * @param {Object} input
 * @param {'anthropic'|'openai'|'google'} input.provider
 * @param {string} input.model
 * @param {string} input.text
 * @returns {number} Estimated token count
 */
export function estimateTokens({ provider, model, text }) {
  if (provider === 'openai') {
    const enc = getEncoderForModel(model);
    try {
      return enc.encode(text).length;
    } catch {
      // Encoder broke mid-use (freed WASM handle, corrupted state): free it,
      // evict every cache alias to it so the next call rebuilds cleanly, and
      // answer with the char heuristic rather than throwing out of a
      // pre-flight budget check.
      try {
        enc.free?.();
      } catch {
        // Already freed — nothing to release.
      }
      for (const [key, cached] of encoderCache.entries()) {
        if (cached === enc) encoderCache.delete(key);
      }
      return Math.ceil(text.length / 4);
    }
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
