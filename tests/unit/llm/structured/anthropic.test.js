import { describe, it, expect } from 'vitest';
import {
  buildAnthropicRequest,
  parseAnthropicResponse,
} from '../../../../lib/llm/structured/anthropic.js';

describe('buildAnthropicRequest', () => {
  it('builds a plain text request without structured output', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-6',
      prompt: 'Say hi.',
    });
    expect(req.body.model).toBe('claude-opus-4-6');
    expect(req.body.messages).toEqual([{ role: 'user', content: 'Say hi.' }]);
    expect(req.body.tools).toBeUndefined();
  });

  it('adds a tool_use tool when structuredOutput is provided', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-6',
      prompt: 'Summarize.',
      structuredOutput: {
        name: 'summary',
        description: 'A structured summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    expect(req.body.tools).toHaveLength(1);
    expect(req.body.tools[0].name).toBe('summary');
    expect(req.body.tools[0].input_schema).toEqual({
      type: 'object',
      properties: { headline: { type: 'string' } },
    });
    expect(req.body.tool_choice).toEqual({ type: 'tool', name: 'summary' });
  });

  it('respects a custom maxTokens override', () => {
    const req = buildAnthropicRequest({
      model: 'claude-opus-4-6',
      prompt: 'Hi.',
      maxTokens: 1024,
    });
    expect(req.body.max_tokens).toBe(1024);
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

  it('returns safe defaults for an empty response', () => {
    const result = parseAnthropicResponse({});
    expect(result.text).toBe('');
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.structured).toBeUndefined();
  });
});
