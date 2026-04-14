import { PROVIDERS } from '../providers.js';

/**
 * Build an HTTP request descriptor for the OpenAI Chat Completions API.
 *
 * Uses the OpenAI strict JSON schema mode for structured output: when
 * `structuredOutput` is provided, response_format is set to a json_schema
 * with strict: true, which forces the model to return JSON conforming to
 * the schema.
 *
 * @param {Object} input
 * @param {string} input.model              OpenAI model id (e.g. 'gpt-5.4')
 * @param {string} input.prompt             User-message content
 * @param {Object} [input.structuredOutput] Optional schema for forced JSON output
 * @param {string}   input.structuredOutput.name    Schema name (also used as the json_schema name)
 * @param {Object}   input.structuredOutput.schema  JSON schema for the response
 * @returns {{ url: string, method: 'POST', headers: Object, body: Object }}
 */
export function buildOpenAIRequest({ model, prompt, structuredOutput }) {
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };
  if (structuredOutput) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: structuredOutput.name,
        strict: true,
        schema: structuredOutput.schema,
      },
    };
  }
  return {
    url: PROVIDERS.openai.baseUrl,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  };
}

/**
 * Parse a raw OpenAI Chat Completions response into Aparture's normalized result.
 *
 * Reads the first choice's message content as text, and token counts from
 * `usage.prompt_tokens` / `usage.completion_tokens`. When
 * `options.expectStructured` is true, parses the text body as JSON into
 * `structured` (OpenAI returns structured output as JSON inside the text
 * field when response_format is json_schema).
 *
 * @param {Object} response Raw OpenAI API response
 * @param {Object} [options]
 * @param {boolean} [options.expectStructured=false] Parse text as JSON into structured field
 * @returns {{ text: string, tokensIn: number, tokensOut: number, structured?: any }}
 */
export function parseOpenAIResponse(response, options = {}) {
  const choices = response.choices ?? [];
  const text = choices[0]?.message?.content ?? '';
  const out = {
    text,
    tokensIn: response.usage?.prompt_tokens ?? 0,
    tokensOut: response.usage?.completion_tokens ?? 0,
  };
  if (options.expectStructured) {
    try {
      out.structured = JSON.parse(text);
    } catch (err) {
      throw new Error(`failed to parse OpenAI structured response as JSON: ${err.message}`);
    }
  }
  return out;
}
