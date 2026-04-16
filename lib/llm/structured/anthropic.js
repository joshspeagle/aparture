import { PROVIDERS } from '../providers.js';

/**
 * Build an HTTP request descriptor for the Anthropic Messages API.
 *
 * Adaptive thinking is enabled by default for all Anthropic models.
 * When thinking is on, tool_choice is limited to "auto" (the API rejects
 * "tool" and "any" with thinking), so the model decides whether to call
 * the provided tool. In practice it will, because the prompt and tool
 * schema guide it.
 *
 * @param {Object} input
 * @param {string} input.model              Anthropic model id (e.g. 'claude-opus-4-7')
 * @param {string} input.prompt             User-message content
 * @param {Object} [input.structuredOutput] Optional tool-schema for forced structured output
 * @param {string}   input.structuredOutput.name        Tool name (also used in tool_choice)
 * @param {string}   [input.structuredOutput.description] Optional tool description
 * @param {Object}   input.structuredOutput.schema      JSON schema for the tool input
 * @param {number} [input.maxTokens=16000]  Anthropic max_tokens (raised for thinking overhead)
 * @returns {{ url: string, method: 'POST', headers: Object, body: Object }}
 */
export function buildAnthropicRequest({ model, prompt, structuredOutput, maxTokens = 16000 }) {
  const body = {
    model,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  };
  if (structuredOutput) {
    body.tools = [
      {
        name: structuredOutput.name,
        description: structuredOutput.description || '',
        input_schema: structuredOutput.schema,
      },
    ];
    // With thinking enabled, only tool_choice "auto" is allowed.
    // The model will still call the tool when prompted with a schema.
    body.tool_choice = { type: 'auto' };
  }
  return {
    url: PROVIDERS.anthropic.baseUrl,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...PROVIDERS.anthropic.extraHeaders,
    },
    body,
  };
}

/**
 * Parse a raw Anthropic Messages API response into Aparture's normalized result.
 *
 * Concatenates all text parts into `text`. Extracts the structured input from
 * a tool_use block into `structured` (assumes a single tool_use; later blocks
 * overwrite earlier ones). Skips `thinking` blocks (adaptive thinking output).
 * Reads token counts from `usage.input_tokens` / `usage.output_tokens`,
 * defaulting to 0 if absent.
 *
 * @param {Object} response Raw Anthropic API response
 * @returns {{ text: string, tokensIn: number, tokensOut: number, structured?: any }}
 */
export function parseAnthropicResponse(response) {
  const out = {
    text: '',
    tokensIn: response.usage?.input_tokens ?? 0,
    tokensOut: response.usage?.output_tokens ?? 0,
  };
  const content = response.content ?? [];
  for (const part of content) {
    if (part.type === 'text') {
      out.text += part.text;
    } else if (part.type === 'tool_use') {
      // With tool_choice "auto" + thinking, the model calls the tool
      // when a schema is provided. Last tool_use wins if multiple appear.
      out.structured = part.input;
    }
    // `thinking` blocks are skipped — they contain internal reasoning
    // and a cryptographic signature, not user-facing content.
  }
  return out;
}
