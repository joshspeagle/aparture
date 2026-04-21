import { PROVIDERS } from '../providers.js';

// Adaptive thinking is supported on Claude Opus and Sonnet but NOT on Haiku
// (verified via live 400: "adaptive thinking is not supported on this model"
// against claude-haiku-4-5). Gate the thinking block on model family so
// Haiku routes still succeed.
function modelSupportsThinking(model) {
  if (!model) return false;
  const lower = model.toLowerCase();
  return lower.startsWith('claude-opus') || lower.startsWith('claude-sonnet');
}

/**
 * Build an HTTP request descriptor for the Anthropic Messages API.
 *
 * Adaptive thinking is enabled for Opus and Sonnet models (the ones that
 * support it). When thinking is on, `tool_choice` must be `{type: "auto"}`
 * (the API rejects "tool" and "any" with thinking), so the model decides
 * whether to call the provided tool. In practice it will, because the
 * prompt and tool schema guide it. When thinking is off (Haiku), we can
 * force the tool call via `tool_choice: {type: "tool", name: <schema.name>}`
 * for guaranteed structured output.
 *
 * @param {Object} input
 * @param {string} input.model              Anthropic model id (e.g. 'claude-opus-4-7')
 * @param {string} input.prompt             User-message content
 * @param {Object} [input.structuredOutput] Optional tool-schema for forced structured output
 * @param {string}   input.structuredOutput.name        Tool name (also used in tool_choice)
 * @param {string}   [input.structuredOutput.description] Optional tool description
 * @param {Object}   input.structuredOutput.schema      JSON schema for the tool input
 * @param {number} [input.maxTokens=16000]  Anthropic max_tokens (raised for thinking overhead)
 * @param {boolean} [input.cacheable=false]     When true, emit content as two-block
 *                                              array with cache_control on the prefix block.
 * @param {string}  [input.cachePrefix='']      Static prefix text to cache. Required
 *                                              (non-empty) when cacheable is true.
 * @param {string}  [input.pdfBase64]           Optional base64-encoded PDF bytes. When present,
 *                                              the user message becomes a multipart content array
 *                                              with a document block followed by the text prompt.
 *                                              Compatible with cacheable (adds cache_control before
 *                                              the document block when cacheable is true).
 * @returns {{ url: string, method: 'POST', headers: Object, body: Object }}
 */
export function buildAnthropicRequest({
  model,
  prompt,
  structuredOutput,
  maxTokens = 16000,
  cacheable = false,
  cachePrefix = '',
  pdfBase64, // NEW: optional PDF bytes (base64 string)
}) {
  let content;

  if (pdfBase64) {
    // PDF path: 2-block (no cache) or 3-block (with cache) content array
    const docBlock = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
    };
    const textBlock = { type: 'text', text: prompt };
    if (cacheable) {
      content = [
        { type: 'text', text: cachePrefix, cache_control: { type: 'ephemeral' } },
        docBlock,
        textBlock,
      ];
    } else {
      content = [docBlock, textBlock];
    }
  } else {
    // Text-only path (existing logic unchanged)
    content = cacheable
      ? [
          { type: 'text', text: cachePrefix, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: prompt },
        ]
      : prompt;
  }
  const thinkingEnabled = modelSupportsThinking(model);
  const body = {
    model,
    max_tokens: maxTokens,
    ...(thinkingEnabled ? { thinking: { type: 'adaptive' } } : {}),
    messages: [{ role: 'user', content }],
  };
  if (structuredOutput) {
    body.tools = [
      {
        name: structuredOutput.name,
        description: structuredOutput.description || '',
        // Strict mode uses grammar-constrained sampling to guarantee the tool
        // input matches the schema exactly (no `"2"` vs `2` type drift).
        // Schemas in the portable subset (type/properties/required/items/enum
        // /additionalProperties) are strict-mode compatible.
        strict: true,
        input_schema: structuredOutput.schema,
      },
    ];
    // With thinking enabled, only tool_choice "auto" is allowed. With
    // thinking disabled (Haiku), force the tool call for guaranteed
    // structured output.
    body.tool_choice = thinkingEnabled
      ? { type: 'auto' }
      : { type: 'tool', name: structuredOutput.name };
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
 * defaulting to 0 if absent. When the provider reports prompt-cache metrics,
 * surfaces them as `cacheReadTok` and `cacheCreateTok` (omitted when absent).
 *
 * @param {Object} response Raw Anthropic API response
 * @returns {{ text: string, tokensIn: number, tokensOut: number, structured?: any,
 *            cacheReadTok?: number, cacheCreateTok?: number }}
 */
export function parseAnthropicResponse(response) {
  const out = {
    text: '',
    tokensIn: response.usage?.input_tokens ?? 0,
    tokensOut: response.usage?.output_tokens ?? 0,
  };
  const cacheRead = response.usage?.cache_read_input_tokens;
  const cacheCreate = response.usage?.cache_creation_input_tokens;
  if (typeof cacheRead === 'number') out.cacheReadTok = cacheRead;
  if (typeof cacheCreate === 'number') out.cacheCreateTok = cacheCreate;
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
