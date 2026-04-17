import { PROVIDERS } from '../providers.js';

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
    body.generationConfig.responseSchema = structuredOutput.schema;
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
