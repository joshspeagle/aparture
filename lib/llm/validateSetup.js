// Free pre-flight validation of API setup (keys, model IDs, request syntax).
//
// NOTE for reviewers: these are direct provider calls that deliberately do
// NOT go through callModel — they are validation probes, not model calls.
// No tokens are sampled and nothing is billed:
//   - Anthropic: POST /v1/messages/count_tokens accepts a complete Messages
//     request (model, system, messages, tools, tool_choice, thinking — no
//     max_tokens) and returns the same 400/401/404 errors a real call would,
//     without sampling. We build the probe body by REUSING the production
//     adapter (buildAnthropicRequest), so the exact syntax the app later
//     sends — strict tools, adaptive-thinking gating, tool_choice rules —
//     is what gets validated.
//   - Google: POST /v1beta/models/{model}:countTokens validates key + model
//     + contents. The contents come from the production adapter
//     (buildGoogleRequest); responseSchema shaping is not exercised here.
//   - OpenAI: has no count-tokens endpoint. GET /v1/models/{model} verifies
//     key + model ID only; request shape is left to the Minimal API Test.
// `fetchImpl` is injectable for tests; each probe is aborted after
// `timeoutMs` (default 10s).

import { PROVIDERS } from './providers.js';
import { buildAnthropicRequest } from './structured/anthropic.js';
import { buildGoogleRequest } from './structured/google.js';

// Tiny representative prompt + strict-tool schema. The schema uses the same
// portable subset the real routes use (type/properties/required/enum +
// additionalProperties), so strict-mode acceptance is genuinely exercised.
const PROBE_PROMPT = 'Reply with the word ready.';
const PROBE_STRUCTURED_OUTPUT = {
  name: 'setup_check',
  description: 'Aparture API setup-check probe',
  schema: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['ready'] },
    },
  },
};

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_MESSAGE_LENGTH = 300;

function makeResult(ok, key, model, requestShape, message) {
  return { ok, checks: { key, model, requestShape }, message };
}

// Extract the provider's human-readable error message from a raw error body.
// All three providers use an {error: {message}} envelope; fall back to the
// raw text, truncated so a giant HTML error page can't flood the UI.
function extractErrorMessage(rawText) {
  let message = rawText ?? '';
  try {
    const json = JSON.parse(rawText);
    message = json?.error?.message || json?.message || message;
  } catch {
    // not JSON — keep raw text
  }
  message = String(message).trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    message = `${message.slice(0, MAX_MESSAGE_LENGTH)}…`;
  }
  return message;
}

// Run one probe with an abort timeout. Returns {response, errorBody} on any
// HTTP response, or throws on network failure / timeout.
async function probeFetch(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const errorBody = response.ok ? null : extractErrorMessage(await response.text());
    return { response, errorBody };
  } finally {
    clearTimeout(timer);
  }
}

function networkFailureResult(providerLabel, err, timeoutMs) {
  const detail =
    err?.name === 'AbortError'
      ? `no response within ${Math.round(timeoutMs / 1000)}s`
      : err?.message || String(err);
  return makeResult(false, null, null, null, `Could not reach ${providerLabel}: ${detail}`);
}

/**
 * Validate an Anthropic model slot for free via /v1/messages/count_tokens.
 *
 * @param {Object} input
 * @param {string} input.model     Anthropic API model id (registry apiId)
 * @param {string} input.apiKey    Anthropic API key
 * @param {Function} [input.fetchImpl=fetch] Injectable fetch for tests
 * @param {number} [input.timeoutMs=10000]   Probe abort timeout
 * @returns {Promise<{ok: boolean, checks: {key: boolean|null, model: boolean|null,
 *                    requestShape: boolean|null}, message: string}>}
 */
export async function validateAnthropic({
  model,
  apiKey,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  // Reuse the production adapter, then keep only the fields count_tokens
  // accepts. This validates the EXACT syntax the app will later send
  // (adaptive-thinking gating, strict tools, tool_choice rules included).
  const req = buildAnthropicRequest({
    model,
    prompt: PROBE_PROMPT,
    structuredOutput: PROBE_STRUCTURED_OUTPUT,
  });
  const countBody = { model: req.body.model, messages: req.body.messages };
  for (const field of ['system', 'tools', 'tool_choice', 'thinking']) {
    if (req.body[field] !== undefined) countBody[field] = req.body[field];
  }

  let response;
  let errorBody;
  try {
    ({ response, errorBody } = await probeFetch(
      fetchImpl,
      'https://api.anthropic.com/v1/messages/count_tokens',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...PROVIDERS.anthropic.extraHeaders,
          [PROVIDERS.anthropic.apiKeyHeader]: apiKey,
        },
        body: JSON.stringify(countBody),
      },
      timeoutMs
    ));
  } catch (err) {
    return networkFailureResult('Anthropic', err, timeoutMs);
  }

  if (response.ok) {
    return makeResult(
      true,
      true,
      true,
      true,
      'Key, model, and request syntax verified. No tokens sampled.'
    );
  }
  const status = response.status;
  if (status === 401 || status === 403) {
    return makeResult(false, false, null, null, errorBody);
  }
  if (status === 404) {
    return makeResult(false, true, false, null, errorBody);
  }
  if (status === 400) {
    return makeResult(false, true, true, false, errorBody);
  }
  return makeResult(false, null, null, null, `Anthropic returned HTTP ${status}: ${errorBody}`);
}

/**
 * Validate a Google model slot for free via models/{model}:countTokens.
 *
 * @param {Object} input
 * @param {string} input.model     Gemini API model id (registry apiId)
 * @param {string} input.apiKey    Google AI Studio API key
 * @param {Function} [input.fetchImpl=fetch] Injectable fetch for tests
 * @param {number} [input.timeoutMs=10000]   Probe abort timeout
 * @returns {Promise<{ok: boolean, checks: {key: boolean|null, model: boolean|null,
 *                    requestShape: boolean|null}, message: string}>}
 */
export async function validateGoogle({
  model,
  apiKey,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  // Reuse the production adapter for URL construction (per-model path,
  // query-param auth) and contents shaping, then retarget :generateContent
  // to :countTokens. countTokens accepts {contents} only — generationConfig
  // (and therefore responseSchema) is not part of its body.
  const req = buildGoogleRequest({
    model,
    prompt: PROBE_PROMPT,
    apiKey,
    structuredOutput: PROBE_STRUCTURED_OUTPUT,
  });
  const url = req.url.replace(':generateContent?', ':countTokens?');
  const body = { contents: req.body.contents };

  let response;
  let errorBody;
  try {
    ({ response, errorBody } = await probeFetch(
      fetchImpl,
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      timeoutMs
    ));
  } catch (err) {
    return networkFailureResult('Google', err, timeoutMs);
  }

  if (response.ok) {
    return makeResult(
      true,
      true,
      true,
      true,
      'Key, model, and message syntax verified. No tokens sampled.'
    );
  }
  const status = response.status;
  // Google reports an invalid key as 400 INVALID_ARGUMENT with an
  // "API key not valid" message (sometimes 401/403 depending on key state),
  // so a 400 must be split into key-vs-shape by message content.
  const looksLikeKeyError = /api[_ ]?key/i.test(errorBody ?? '');
  if (status === 401 || status === 403 || (status === 400 && looksLikeKeyError)) {
    return makeResult(false, false, null, null, errorBody);
  }
  if (status === 404) {
    return makeResult(false, true, false, null, errorBody);
  }
  if (status === 400) {
    return makeResult(false, true, true, false, errorBody);
  }
  return makeResult(false, null, null, null, `Google returned HTTP ${status}: ${errorBody}`);
}

/**
 * Validate an OpenAI model slot for free via GET /v1/models/{model}.
 *
 * OpenAI has no count-tokens endpoint, so only the key and model ID are
 * verified; request shape stays null and is exercised by the Minimal API
 * Test instead.
 *
 * @param {Object} input
 * @param {string} input.model     OpenAI API model id (registry apiId)
 * @param {string} input.apiKey    OpenAI API key
 * @param {Function} [input.fetchImpl=fetch] Injectable fetch for tests
 * @param {number} [input.timeoutMs=10000]   Probe abort timeout
 * @returns {Promise<{ok: boolean, checks: {key: boolean|null, model: boolean|null,
 *                    requestShape: boolean|null}, message: string}>}
 */
export async function validateOpenAI({
  model,
  apiKey,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  let response;
  let errorBody;
  try {
    ({ response, errorBody } = await probeFetch(
      fetchImpl,
      `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
      {
        method: 'GET',
        headers: {
          [PROVIDERS.openai.apiKeyHeader]: `${PROVIDERS.openai.apiKeyPrefix}${apiKey}`,
        },
      },
      timeoutMs
    ));
  } catch (err) {
    return networkFailureResult('OpenAI', err, timeoutMs);
  }

  if (response.ok) {
    return makeResult(
      true,
      true,
      true,
      null,
      'Key and model verified; request shape is only exercised by the Minimal API Test.'
    );
  }
  const status = response.status;
  if (status === 401 || status === 403) {
    return makeResult(false, false, null, null, errorBody);
  }
  if (status === 404) {
    return makeResult(false, true, false, null, errorBody);
  }
  return makeResult(false, null, null, null, `OpenAI returned HTTP ${status}: ${errorBody}`);
}

const SETUP_VALIDATORS = {
  anthropic: validateAnthropic,
  google: validateGoogle,
  openai: validateOpenAI,
};

/**
 * Dispatch to the right per-provider validator.
 *
 * @param {Object} input
 * @param {'anthropic'|'google'|'openai'} input.provider
 * @param {string} input.model   Provider API model id (registry apiId)
 * @param {string} input.apiKey
 * @param {Function} [input.fetchImpl]
 * @param {number} [input.timeoutMs]
 */
export async function validateProviderSetup({ provider, model, apiKey, fetchImpl, timeoutMs }) {
  const validator = SETUP_VALIDATORS[provider];
  if (!validator) {
    return makeResult(false, null, null, null, `Unknown provider: ${provider}`);
  }
  return validator({
    model,
    apiKey,
    ...(fetchImpl ? { fetchImpl } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
  });
}
