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
 * @param {string} [input.apiKey]          API key (ignored in fixture mode)
 * @param {boolean} [input.cacheable]      When true + provider='anthropic', enables prompt
 *                                         caching via cache_control marker on cachePrefix.
 * @param {string}  [input.cachePrefix]    Static prefix content to cache. Required (non-empty)
 *                                         when cacheable is true. Ignored for non-Anthropic.
 * @param {string}  [input.pdfBase64]      Optional base64-encoded PDF bytes. Passed to adapters
 *                                         for providers that support native PDF content blocks
 *                                         (Anthropic, Google, OpenAI Responses). When present
 *                                         the OpenAI branch uses /v1/responses instead of
 *                                         /v1/chat/completions.
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

  // Apply test overrides before hashing so fixture lookups are stable.
  // APARTURE_TEST_PDF_OVERRIDE replaces pdfBase64 with a constant placeholder,
  // ensuring the fixture hash doesn't depend on actual PDF byte content.
  const effectiveInput = { ...input };
  if (process.env.APARTURE_TEST_PDF_OVERRIDE && effectiveInput.pdfBase64 !== undefined) {
    effectiveInput.pdfBase64 = process.env.APARTURE_TEST_PDF_OVERRIDE;
  }

  if (options.mode === 'fixture') {
    if (!options.fixturesDir) {
      throw new Error('fixturesDir required in fixture mode');
    }
    const cached = await loadFixture(effectiveInput, options.fixturesDir);
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
  if (input.pdfBase64) logPayload.hasPdf = true;
  console.log(`Sending request to ${providerLabel}:`, logPayload);

  // Helper: log raw provider error server-side, throw sanitized message to caller.
  // Prevents API keys or sensitive provider details from reaching the browser.
  function throwProviderError(provider, status, rawText) {
    console.error(`[${provider}] API error ${status}:`, rawText);
    throw new Error(`${provider} request failed (${status})`);
  }

  if (effectiveInput.provider === 'anthropic') {
    const { buildAnthropicRequest, parseAnthropicResponse } = await import(
      './structured/anthropic.js'
    );
    const req = buildAnthropicRequest(effectiveInput);
    const authValue = providerCfg.apiKeyPrefix
      ? `${providerCfg.apiKeyPrefix}${effectiveInput.apiKey}`
      : effectiveInput.apiKey;
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

  if (effectiveInput.provider === 'google') {
    const { buildGoogleRequest, parseGoogleResponse } = await import('./structured/google.js');
    const req = buildGoogleRequest(effectiveInput);
    const response = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      throwProviderError('google', response.status, await response.text());
    }
    const json = await response.json();
    return parseGoogleResponse(json, { expectStructured: !!effectiveInput.structuredOutput });
  }

  if (effectiveInput.provider === 'openai') {
    const {
      buildOpenAIRequest,
      buildOpenAIResponsesRequest,
      parseOpenAIResponse,
      parseOpenAIResponsesResponse,
    } = await import('./structured/openai.js');

    const req = effectiveInput.pdfBase64
      ? buildOpenAIResponsesRequest(effectiveInput)
      : buildOpenAIRequest(effectiveInput);

    const authValue = providerCfg.apiKeyPrefix
      ? `${providerCfg.apiKeyPrefix}${effectiveInput.apiKey}`
      : effectiveInput.apiKey;

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
    const result = effectiveInput.pdfBase64
      ? parseOpenAIResponsesResponse(json)
      : parseOpenAIResponse(json, { expectStructured: !!effectiveInput.structuredOutput });
    if (result.cacheReadTok) {
      console.log(`[openai cache] read=${result.cacheReadTok}`);
    }
    return result;
  }

  throw new Error(`live mode not yet implemented for provider: ${effectiveInput.provider}`);
}
