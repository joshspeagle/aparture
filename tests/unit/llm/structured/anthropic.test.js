import { describe, it, expect } from 'vitest';
import {
  buildAnthropicRequest,
  parseAnthropicResponse,
} from '../../../../lib/llm/structured/anthropic.js';

describe('buildAnthropicRequest', () => {
  it('builds a plain text request with adaptive thinking', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-7',
      prompt: 'Say hi.',
    });
    expect(req.body.model).toBe('claude-opus-4-7');
    expect(req.body.messages).toEqual([{ role: 'user', content: 'Say hi.' }]);
    expect(req.body.thinking).toEqual({ type: 'adaptive' });
    expect(req.body.tools).toBeUndefined();
  });

  it('uses tool_choice auto with structured output on Opus (thinking enabled)', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-7',
      prompt: 'Summarize.',
      structuredOutput: {
        name: 'summary',
        description: 'A structured summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    expect(req.body.tools).toHaveLength(1);
    expect(req.body.tools[0].name).toBe('summary');
    // strict: true enables grammar-constrained sampling so tool inputs
    // exactly match the schema (no `"2"` vs `2` type drift).
    expect(req.body.tools[0].strict).toBe(true);
    expect(req.body.tools[0].input_schema).toEqual({
      type: 'object',
      properties: { headline: { type: 'string' } },
    });
    // Thinking requires tool_choice "auto" — "tool" is not supported
    expect(req.body.tool_choice).toEqual({ type: 'auto' });
  });

  it('disables thinking and forces tool_choice on Haiku (thinking unsupported)', () => {
    const req = buildAnthropicRequest({
      model: 'claude-haiku-4-5',
      prompt: 'Summarize.',
      structuredOutput: {
        name: 'summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    // No thinking block — Haiku models reject adaptive thinking.
    expect(req.body.thinking).toBeUndefined();
    // With thinking off, forced tool_choice is allowed and used for
    // guaranteed structured output.
    expect(req.body.tool_choice).toEqual({ type: 'tool', name: 'summary' });
  });

  it('defaults max_tokens to 16000 for thinking overhead', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-7',
      prompt: 'Hi.',
    });
    expect(req.body.max_tokens).toBe(16000);
  });

  it('respects a custom maxTokens override', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-7',
      prompt: 'Hi.',
      maxTokens: 1024,
    });
    expect(req.body.max_tokens).toBe(1024);
  });

  it('produces a plain-string content field when cacheable is omitted (backward compat)', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-7',
      prompt: 'Hello world',
    });
    expect(req.body.messages).toEqual([{ role: 'user', content: 'Hello world' }]);
  });

  it('produces a two-block content array with cache_control on the prefix block when cacheable is true', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-7',
      prompt: 'Variable tail',
      cacheable: true,
      cachePrefix: 'Static prefix text',
    });
    expect(req.body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Static prefix text', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'Variable tail' },
        ],
      },
    ]);
  });

  it('produces a two-block content array with document block when pdfBase64 is provided', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-6',
      prompt: 'Analyze this paper.',
      pdfBase64: 'AAAA',
    });
    expect(req.body.messages[0].content).toEqual([
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'AAAA' },
      },
      { type: 'text', text: 'Analyze this paper.' },
    ]);
  });

  it('produces a three-block content array with cache_control then document then text when cacheable + pdfBase64', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-6',
      prompt: 'Analyze this paper.',
      pdfBase64: 'AAAA',
      cacheable: true,
      cachePrefix: 'Static scoring rubric.',
    });
    expect(req.body.messages[0].content).toEqual([
      {
        type: 'text',
        text: 'Static scoring rubric.',
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'AAAA' },
      },
      { type: 'text', text: 'Analyze this paper.' },
    ]);
  });
});

describe('parseAnthropicResponse', () => {
  it('extracts text content', () => {
    const response = {
      content: [{ type: 'text', text: 'Hello there.' }],
      usage: { input_tokens: 10, output_tokens: 3 },
    };
    const result = parseAnthropicResponse(response);
    expect(result.text).toBe('Hello there.');
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(3);
    expect(result.structured).toBeUndefined();
  });

  it('extracts structured tool_use payload', () => {
    const response = {
      content: [{ type: 'tool_use', name: 'summary', input: { headline: 'Big news' } }],
      usage: { input_tokens: 20, output_tokens: 8 },
    };
    const result = parseAnthropicResponse(response);
    expect(result.structured).toEqual({ headline: 'Big news' });
    expect(result.tokensIn).toBe(20);
  });

  it('concatenates multiple text parts in order', () => {
    const response = {
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world.' },
      ],
      usage: { input_tokens: 5, output_tokens: 2 },
    };
    const result = parseAnthropicResponse(response);
    expect(result.text).toBe('Hello world.');
  });

  it('skips thinking blocks from adaptive thinking', () => {
    const response = {
      content: [
        {
          type: 'thinking',
          thinking: 'Let me reason about this...',
          signature: 'WaUjzkypQ2mUEVM36O2...',
        },
        { type: 'text', text: 'The answer is 42.' },
      ],
      usage: { input_tokens: 15, output_tokens: 10 },
    };
    const result = parseAnthropicResponse(response);
    expect(result.text).toBe('The answer is 42.');
    expect(result.structured).toBeUndefined();
    expect(result.tokensIn).toBe(15);
  });

  it('handles thinking block followed by tool_use', () => {
    const response = {
      content: [
        {
          type: 'thinking',
          thinking: 'I should use the tool...',
          signature: 'abc123...',
        },
        { type: 'tool_use', name: 'summary', input: { headline: 'Big news' } },
      ],
      usage: { input_tokens: 25, output_tokens: 12 },
    };
    const result = parseAnthropicResponse(response);
    expect(result.structured).toEqual({ headline: 'Big news' });
    expect(result.text).toBe('');
  });

  it('returns safe defaults for an empty response', () => {
    const result = parseAnthropicResponse({});
    expect(result.text).toBe('');
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.structured).toBeUndefined();
  });

  it('surfaces cache_read_input_tokens and cache_creation_input_tokens when present', () => {
    const out = parseAnthropicResponse({
      content: [{ type: 'text', text: 'ok' }],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 900,
        cache_creation_input_tokens: 100,
      },
    });
    expect(out.tokensIn).toBe(10);
    expect(out.tokensOut).toBe(5);
    expect(out.cacheReadTok).toBe(900);
    expect(out.cacheCreateTok).toBe(100);
  });

  it('omits cache token fields when provider does not report them', () => {
    const out = parseAnthropicResponse({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(out.cacheReadTok).toBeUndefined();
    expect(out.cacheCreateTok).toBeUndefined();
  });
});
