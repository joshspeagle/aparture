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
 * @param {boolean} [input.cacheable]      When true + provider='anthropic', enables prompt
 *                                         caching via cache_control marker on cachePrefix.
 * @param {string}  [input.cachePrefix]    Static prefix content to cache. Required (non-empty)
 *                                         when cacheable is true. Ignored for non-Anthropic.
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
  const logPayload = {
    model: input.model,
    promptLength: input.prompt?.length ?? 0,
    structured: !!input.structuredOutput,
  };
  if (input.cacheable) logPayload.cacheable = true;
  console.log(`Sending request to ${providerLabel}:`, logPayload);

  // Helper: log raw provider error server-side, throw sanitized message to caller.
  // Prevents API keys or sensitive provider details from reaching the browser.
  function throwProviderError(provider, status, rawText) {
    console.error(`[${provider}] API error ${status}:`, rawText);
    throw new Error(`${provider} request failed (${status})`);
  }

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
      throwProviderError('anthropic', response.status, await response.text());
    }
    const json = await response.json();
    const result = parseAnthropicResponse(json);
    if (result.cacheReadTok || result.cacheCreateTok) {
      console.log(
        `[anthropic cache] read=${result.cacheReadTok ?? 0} create=${result.cacheCreateTok ?? 0}`
      );
    }
    return result;
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
      throwProviderError('google', response.status, await response.text());
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
      throwProviderError('openai', response.status, await response.text());
    }
    const json = await response.json();
    const result = parseOpenAIResponse(json, { expectStructured: !!input.structuredOutput });
    if (result.cacheReadTok) {
      console.log(`[openai cache] read=${result.cacheReadTok}`);
    }
    return result;
  }

  throw new Error(`live mode not yet implemented for provider: ${input.provider}`);
}
