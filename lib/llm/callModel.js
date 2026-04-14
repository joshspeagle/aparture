import { loadFixture } from './fixtures.js';
import { getProviderConfig } from './providers.js';

/**
 * Call an LLM provider.
 *
 * @param {Object} input
 * @param {'anthropic'|'openai'|'google'} input.provider
 * @param {string} input.model
 * @param {string} input.prompt           Plain-text prompt (used for fixture hashing and live fallback)
 * @param {Object} [input.structuredOutput] Optional structured-output schema
 * @param {Object} [input.providerPayload]  Optional provider-specific payload override
 * @param {string} [input.apiKey]          API key (ignored in fixture mode)
 *
 * @param {Object} options
 * @param {'live'|'fixture'} options.mode
 * @param {string} [options.fixturesDir]   Required when mode='fixture'
 *
 * @returns {Promise<{text: string, tokensIn: number, tokensOut: number, structured?: any}>}
 */
export async function callModel(input, options = { mode: 'live' }) {
  // Validate provider up front
  getProviderConfig(input.provider);

  if (options.mode === 'fixture') {
    if (!options.fixturesDir) {
      throw new Error('fixturesDir required in fixture mode');
    }
    const cached = await loadFixture(input, options.fixturesDir);
    if (cached === null) {
      throw new Error(
        `no fixture found for input (provider=${input.provider}, model=${input.model})`
      );
    }
    return cached;
  }

  // Live mode is stubbed in this task and will be filled in by subsequent
  // per-provider structured-output tasks (Tasks 6, 7, 8).
  throw new Error('live mode not yet implemented — see Tasks 6-8');
}
