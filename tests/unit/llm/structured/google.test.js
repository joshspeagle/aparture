import { describe, it, expect } from 'vitest';
import { buildGoogleRequest, parseGoogleResponse } from '../../../../lib/llm/structured/google.js';

describe('buildGoogleRequest', () => {
  it('builds a plain text request with a contents array', () => {
    const req = buildGoogleRequest({
      model: 'gemini-2.5-flash',
      prompt: 'Say hi.',
      apiKey: 'test-key',
    });
    expect(req.url).toContain('gemini-2.5-flash');
    expect(req.url).toContain('key=test-key');
    expect(req.body.contents[0].parts[0].text).toBe('Say hi.');
    expect(req.body.generationConfig?.responseSchema).toBeUndefined();
  });

  it('adds responseSchema + responseMimeType when structuredOutput is provided', () => {
    const req = buildGoogleRequest({
      model: 'gemini-2.5-flash',
      prompt: 'Summarize.',
      apiKey: 'test-key',
      structuredOutput: {
        name: 'summary',
        schema: { type: 'object', properties: { headline: { type: 'string' } } },
      },
    });
    expect(req.body.generationConfig.responseMimeType).toBe('application/json');
    expect(req.body.generationConfig.responseSchema).toEqual({
      type: 'object',
      properties: { headline: { type: 'string' } },
    });
  });
});

describe('parseGoogleResponse', () => {
  it('extracts text content', () => {
    const response = {
      candidates: [{ content: { parts: [{ text: 'Hello.' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
    };
    const result = parseGoogleResponse(response);
    expect(result.text).toBe('Hello.');
    expect(result.tokensIn).toBe(10);
    expect(result.tokensOut).toBe(2);
  });

  it('parses structured JSON when responseSchema was requested', () => {
    const response = {
      candidates: [{ content: { parts: [{ text: '{"headline":"Big news"}' }] } }],
      usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 5 },
    };
    const result = parseGoogleResponse(response, { expectStructured: true });
    expect(result.structured).toEqual({ headline: 'Big news' });
  });
});
