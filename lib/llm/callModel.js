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
  // Validate provider up front and capture config for downstream use
  const providerCfg = getProviderConfig(input.provider);

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

  // Live mode — log the call so synthesis/check-briefing/suggest-profile
  // show progress in the dev terminal, matching the pattern legacy routes use.
  const providerLabel = input.provider.charAt(0).toUpperCase() + input.provider.slice(1);
  console.log(`Sending request to ${providerLabel}:`, {
    model: input.model,
    promptLength: input.prompt?.length ?? 0,
    structured: !!input.structuredOutput,
  });

  if (input.provider === 'anthropic') {
    const { buildAnthropicRequest, parseAnthropicResponse } = await import(
      './structured/anthropic.js'
    );
    const req = buildAnthropicRequest(input);
    const authValue = providerCfg.apiKeyPrefix
      ? `${providerCfg.apiKeyPrefix}${input.apiKey}`
      : input.apiKey;
    const response = await fetch(req.url, {
      method: req.method,
      headers: {
        ...req.headers,
        [providerCfg.apiKeyHeader]: authValue,
      },
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`anthropic request failed: ${response.status} ${errText}`);
    }
    const json = await response.json();
    return parseAnthropicResponse(json);
  }

  if (input.provider === 'google') {
    const { buildGoogleRequest, parseGoogleResponse } = await import('./structured/google.js');
    const req = buildGoogleRequest(input);
    const response = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`google request failed: ${response.status} ${errText}`);
    }
    const json = await response.json();
    return parseGoogleResponse(json, { expectStructured: !!input.structuredOutput });
  }

  if (input.provider === 'openai') {
    const { buildOpenAIRequest, parseOpenAIResponse } = await import('./structured/openai.js');
    const req = buildOpenAIRequest(input);
    const authValue = providerCfg.apiKeyPrefix
      ? `${providerCfg.apiKeyPrefix}${input.apiKey}`
      : input.apiKey;
    const response = await fetch(req.url, {
      method: req.method,
      headers: {
        ...req.headers,
        [providerCfg.apiKeyHeader]: authValue,
      },
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`openai request failed: ${response.status} ${errText}`);
    }
    const json = await response.json();
    return parseOpenAIResponse(json, { expectStructured: !!input.structuredOutput });
  }

  throw new Error(`live mode not yet implemented for provider: ${input.provider}`);
}
