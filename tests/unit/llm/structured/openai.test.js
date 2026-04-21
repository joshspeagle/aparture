import { describe, it, expect } from 'vitest';
import {
  buildOpenAIRequest,
  buildOpenAIResponsesRequest,
  parseOpenAIResponse,
  parseOpenAIResponsesResponse,
} from '../../../../lib/llm/structured/openai.js';

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

  it('returns empty text when choices array is missing', () => {
    const out = parseOpenAIResponse({});
    expect(out.text).toBe('');
  });
});

describe('buildOpenAIResponsesRequest', () => {
  it('targets /v1/responses with input_file and input_text blocks', () => {
    const req = buildOpenAIResponsesRequest({
      model: 'gpt-5.4',
      prompt: 'Analyze this paper.',
      pdfBase64: 'CCCC',
    });
    expect(req.url).toBe('https://api.openai.com/v1/responses');
    expect(req.body.input[0].role).toBe('user');
    expect(req.body.input[0].content).toEqual([
      {
        type: 'input_file',
        filename: 'research_paper.pdf',
        file_data: 'data:application/pdf;base64,CCCC',
      },
      { type: 'input_text', text: 'Analyze this paper.' },
    ]);
    expect(req.body.text).toBeUndefined();
  });

  it('adds text.format.json_schema when structuredOutput is provided', () => {
    const schema = {
      type: 'object',
      required: ['answer'],
      additionalProperties: false,
      properties: { answer: { type: 'string' } },
    };
    const req = buildOpenAIResponsesRequest({
      model: 'gpt-5.4',
      prompt: 'p',
      pdfBase64: 'CCCC',
      structuredOutput: { name: 'paper_analysis', schema },
    });
    expect(req.body.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'paper_analysis',
        strict: true,
        schema,
      },
    });
  });
});

describe('parseOpenAIResponsesResponse', () => {
  it('extracts text from output[].content[].text and token counts', () => {
    const response = {
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Result text.' }] }],
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    const out = parseOpenAIResponsesResponse(response);
    expect(out.text).toBe('Result text.');
    expect(out.tokensIn).toBe(100);
    expect(out.tokensOut).toBe(50);
  });

  it('skips non-message items and reads the first message item', () => {
    const response = {
      output: [
        { type: 'function_call', content: [] },
        { type: 'message', content: [{ type: 'output_text', text: 'Hello from message.' }] },
      ],
      usage: { input_tokens: 20, output_tokens: 10 },
    };
    const out = parseOpenAIResponsesResponse(response);
    expect(out.text).toBe('Hello from message.');
  });

  it('returns empty text when output array is missing', () => {
    expect(parseOpenAIResponsesResponse({}).text).toBe('');
  });

  it('defaults to zero tokens when usage is absent', () => {
    const out = parseOpenAIResponsesResponse({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }],
    });
    expect(out.tokensIn).toBe(0);
    expect(out.tokensOut).toBe(0);
  });

  it('parses structured JSON when expectStructured is true', () => {
    const response = {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: '{"answer":"42"}' }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    const out = parseOpenAIResponsesResponse(response, { expectStructured: true });
    expect(out.structured).toEqual({ answer: '42' });
  });

  it('throws when expectStructured is true and text is not JSON', () => {
    const response = {
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }],
    };
    expect(() => parseOpenAIResponsesResponse(response, { expectStructured: true })).toThrow(
      /failed to parse OpenAI Responses structured output/
    );
  });
});
