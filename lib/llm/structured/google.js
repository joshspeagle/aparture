import { PROVIDERS } from '../providers.js';

// Google's responseSchema endpoint uses an OpenAPI 3.0 subset that rejects
// several JSON Schema fields. Nov 2025 added native `additionalProperties`
// support to the newer `response_json_schema` field, NOT the `responseSchema`
// field used here — verified via live 400 error:
//   "Unknown name 'additionalProperties' at 'generation_config.response_schema'".
// So we still strip it. We also strip `$schema`/`$id`/`$ref`.
const GOOGLE_UNSUPPORTED_KEYS = new Set(['additionalProperties', '$schema', '$id', '$ref']);

// OpenAPI 3.0 represents optional/nullable fields as `nullable: true` rather
// than JSON Schema's `type: ["T", "null"]` union. When we see the union form
// (added for OpenAI strict compatibility), convert it: unwrap the primary
// type and set `nullable: true`.
function convertNullableTypeUnion(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  if (!Array.isArray(node.type)) return node;
  const nonNull = node.type.filter((t) => t !== 'null');
  const hasNull = node.type.includes('null');
  if (nonNull.length !== 1) return node; // leave unchanged if we can't unambiguously pick
  return { ...node, type: nonNull[0], ...(hasNull ? { nullable: true } : {}) };
}

function sanitizeSchemaForGoogle(node) {
  if (Array.isArray(node)) return node.map(sanitizeSchemaForGoogle);
  if (node && typeof node === 'object') {
    const converted = convertNullableTypeUnion(node);
    const out = {};
    for (const [k, v] of Object.entries(converted)) {
      if (GOOGLE_UNSUPPORTED_KEYS.has(k)) continue;
      out[k] = sanitizeSchemaForGoogle(v);
    }
    return out;
  }
  return node;
}

/**
 * Build an HTTP request descriptor for the Google Gemini generateContent API.
 *
 * Google uses per-model URLs (`/v1beta/models/<model>:generateContent`) and
 * query-parameter auth (`?key=<apiKey>`) rather than a header. The apiKey
 * is embedded directly in the returned URL, so callModel does not need to
 * add an auth header for Google requests.
 *
 * @param {Object} input
 * @param {string} input.model              Gemini model id (e.g. 'gemini-2.5-flash')
 * @param {string} input.prompt             User-message content
 * @param {string} input.apiKey             Google AI Studio API key (embedded in URL)
 * @param {Object} [input.structuredOutput] Optional schema for forced JSON output
 * @param {Object}   input.structuredOutput.schema  JSON schema for the response
 * @param {string} [input.pdfBase64]        Optional base64-encoded PDF. When present, appended as
 *                                           an inlineData part after the text prompt.
 * @returns {{ url: string, method: 'POST', headers: Object, body: Object }}
 */
export function buildGoogleRequest({ model, prompt, apiKey, structuredOutput, pdfBase64 }) {
  const baseUrl = PROVIDERS.google.baseUrl;
  const queryParam = PROVIDERS.google.apiKeyQueryParam;
  const url = `${baseUrl}/${encodeURIComponent(model)}:generateContent?${queryParam}=${encodeURIComponent(apiKey)}`;

  const parts = [{ text: prompt }];
  if (pdfBase64) {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {},
  };
  if (structuredOutput) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = sanitizeSchemaForGoogle(structuredOutput.schema);
  }
  return {
    url,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  };
}

/**
 * Parse a raw Google generateContent response into Aparture's normalized result.
 *
 * Concatenates all text parts from the first candidate. Reads token counts from
 * usageMetadata.promptTokenCount / candidatesTokenCount, defaulting to 0 if absent.
 * When `options.expectStructured` is true, parses the text body as JSON into
 * `structured` (Google returns structured output as JSON inside the text field,
 * not as a separate block like Anthropic's tool_use).
 *
 * @param {Object} response Raw Google API response
 * @param {Object} [options]
 * @param {boolean} [options.expectStructured=false] Parse text as JSON into structured field
 * @returns {{ text: string, tokensIn: number, tokensOut: number, structured?: any }}
 */
export function parseGoogleResponse(response, options = {}) {
  const candidates = response.candidates ?? [];
  const first = candidates[0];
  const parts = first?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('');
  const out = {
    text,
    tokensIn: response.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
  if (options.expectStructured) {
    try {
      out.structured = JSON.parse(text);
    } catch (err) {
      throw new Error(`failed to parse Google structured response as JSON: ${err.message}`);
    }
  }
  return out;
}
