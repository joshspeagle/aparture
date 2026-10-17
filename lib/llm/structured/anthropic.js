import { PROVIDERS } from '../providers.js';
import { RefusalError } from '../RefusalError.js';
import { supportsAdaptiveThinkingByApiId } from '../../../utils/models.js';

// Adaptive thinking (`thinking: {type: 'adaptive'}`) is accepted by every
// current Claude model except Haiku 4.5. The registry (utils/models.js) is
// the single source of truth: every Anthropic MODEL_REGISTRY entry carries a
// `supportsAdaptiveThinking` flag, consulted first via
// supportsAdaptiveThinkingByApiId. The version-parsing fallback below applies
// ONLY to apiIds absent from the registry (smoke-script
// `--model-anthropic=<id>` overrides, unregistered/raw ids), so every model
// the adapter might see gets a request shape its API accepts.
function modelSupportsThinking(model) {
  if (!model) return false;
  const registered = supportsAdaptiveThinkingByApiId(model);
  if (registered !== undefined) return registered;
  const id = model.toLowerCase();
  // Fable and Mythos run with thinking always on.
  if (/^claude-(?:fable|mythos)-/.test(id)) return true;
  // Haiku gained adaptive thinking at 5.x; Haiku 4.5 and older 400 on it.
  const haiku = id.match(/^claude-haiku-(\d+)/);
  if (haiku) return parseInt(haiku[1], 10) >= 5;
  // Opus/Sonnet: 4.6 and later. Pre-4.6 models (claude-opus-4-5,
  // claude-sonnet-4-5, claude-opus-4-1) require the older
  // `{type: 'enabled', budget_tokens}` shape and reject adaptive. Matches
  // apiIds like claude-opus-4-8 and dotted user-facing forms like
  // claude-opus-4.7. Date-stamped suffixes (claude-sonnet-4-5-20250929)
  // parse as major 4 / minor 5 as intended; date-first ids
  // (claude-3-5-sonnet-20241022) don't match and fall through to false.
  const match = id.match(/^claude-(?:opus|sonnet)-(\d+)(?:[-.](\d+))?/);
  if (!match) return false;
  const major = parseInt(match[1], 10);
  // A "minor" with 4+ digits is a date stamp directly after the major
  // (claude-opus-4-20250514), not a real minor version — treat as .0.
  const minor = match[2] && match[2].length < 4 ? parseInt(match[2], 10) : 0;
  return major > 4 || (major === 4 && minor >= 6);
}

/**
 * Build an HTTP request descriptor for the Anthropic Messages API.
 *
 * Structured output uses `output_config.format` (a JSON schema): the reply's
 * text block is guaranteed to parse and match the schema, with or without
 * thinking, and no tool_choice is involved. (The earlier strict-tool path
 * needed forced tool_choice when thinking was off and an optional tool call
 * when it was on; Fable 5.1, Opus 5.5 and Sonnet 5.5 reject forced
 * tool_choice outright.)
 *
 * @param {Object} input
 * @param {string} input.model              Anthropic model id (e.g. 'claude-opus-5-5')
 * @param {string} input.prompt             User-message content
 * @param {Object} [input.structuredOutput] Optional schema for the reply
 * @param {Object}   input.structuredOutput.schema  JSON schema the reply must match
 * @param {number} [input.maxTokens=16000]  Anthropic max_tokens (raised for thinking overhead)
 * @param {'low'|'medium'|'high'|'xhigh'|'max'} [input.effort]
 *                                          Optional output_config.effort; ignored for models
 *                                          without adaptive thinking (Haiku 4.5 rejects it).
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
  effort,
  cacheable = false,
  cachePrefix = '',
  pdfBase64,
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
  const outputConfig = {};
  if (structuredOutput) {
    outputConfig.format = { type: 'json_schema', schema: structuredOutput.schema };
  }
  if (effort && thinkingEnabled) outputConfig.effort = effort;
  if (Object.keys(outputConfig).length > 0) body.output_config = outputConfig;
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
 * Concatenates all text parts into `text`, skipping `thinking` blocks. With
 * `options.expectStructured`, parses that text as JSON into `structured`
 * (output_config.format guarantees it parses unless generation was cut
 * short). A `tool_use` block, if present, also populates `structured`, so
 * responses recorded under the earlier strict-tool path still parse. Reads
 * token counts from `usage.input_tokens` / `usage.output_tokens`, defaulting
 * to 0 if absent. When the provider reports prompt-cache metrics, surfaces
 * them as `cacheReadTok` and `cacheCreateTok` (omitted when absent).
 *
 * @param {Object} response Raw Anthropic API response
 * @param {Object} [options]
 * @param {boolean} [options.expectStructured=false] Parse text as JSON into structured field
 * @returns {{ text: string, tokensIn: number, tokensOut: number, structured?: any,
 *            cacheReadTok?: number, cacheCreateTok?: number }}
 */
export function parseAnthropicResponse(response, options = {}) {
  // Safety classifiers decline with HTTP 200 + stop_reason "refusal" and an
  // empty content array (pre-output) or a partial one (mid-stream). Check
  // before reading content so a refusal surfaces as a typed RefusalError
  // rather than an empty-structured-output parse failure downstream.
  // `stop_details` is informational and can be null even on a refusal, so
  // branch on stop_reason and treat stop_details as best-effort detail.
  if (response.stop_reason === 'refusal') {
    throw new RefusalError({
      provider: 'anthropic',
      model: response.model ?? null,
      raw: response.stop_details?.category ?? null,
      explanation: response.stop_details?.explanation ?? null,
    });
  }
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
      out.structured = part.input;
    }
    // `thinking` blocks are skipped — they contain internal reasoning
    // and a cryptographic signature, not user-facing content.
  }

  if (options.expectStructured && out.structured === undefined) {
    if (response.stop_reason === 'max_tokens') {
      // Thinking counts toward max_tokens, so a long reply can be cut off
      // mid-JSON. Name the cause instead of surfacing a JSON parse error.
      throw new Error(
        `Anthropic reply was cut off at max_tokens (${out.tokensOut} output tokens) before the structured output finished`
      );
    }
    try {
      out.structured = JSON.parse(out.text);
    } catch (err) {
      throw new Error(`failed to parse Anthropic structured response as JSON: ${err.message}`);
    }
  }
  return out;
}
