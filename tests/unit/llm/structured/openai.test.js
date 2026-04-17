import { describe, it, expect } from 'vitest';
import { buildOpenAIRequest, parseOpenAIResponse } from '../../../../lib/llm/structured/openai.js';

describe('buildOpenAIRequest', () => {
  it('builds a plain text request', () => {
    const req = buildOpenAIRequest({ model: 'gpt-5.4', prompt: 'Say hi.' });
    expect(req.body.model).toBe('gpt-5.4');
    expect(req.body.messages).toEqual([{ role: 'user', content: 'Say hi.' }]);
    expect(req.body.response_format).toBeUndefined();
  });

  it('adds a strict json_schema response_format when structuredOutput is provided', () => {
    const req = buildOpenAIRequest({
      model: 'gpt-5.4',
      prompt: 'Summarize.',
      structuredOutput: {
        name: 'summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    expect(req.body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'summary',
        strict: true,
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
  });
});

describe('parseOpenAIResponse', () => {
  it('extracts text content', () => {
    const response = {
      choices: [{ message: { content: 'Hello.' } }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    };
    const result = parseOpenAIResponse(response);
    expect(result.text).toBe('Hello.');
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(2);
  });

  it('parses structured JSON when requested', () => {
    const response = {
      choices: [{ message: { content: '{"headline":"Big news"}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 5 },
    };
    const result = parseOpenAIResponse(response, { expectStructured: true });
    expect(result.structured).toEqual({ headline: 'Big news' });
  });

  it('surfaces cached_tokens from prompt_tokens_details when > 0', () => {
    const out = parseOpenAIResponse({
      choices: [{ message: { content: 'ok' } }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        prompt_tokens_details: { cached_tokens: 60 },
      },
    });
    expect(out.cacheReadTok).toBe(60);
  });

  it('omits cacheReadTok when cached_tokens is 0 or missing', () => {
    const out = parseOpenAIResponse({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });
    expect(out.cacheReadTok).toBeUndefined();
  });
});
