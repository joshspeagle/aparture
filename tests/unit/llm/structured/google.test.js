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

  it('strips additionalProperties and $schema/$id/$ref from responseSchema (v1beta does not support them)', () => {
    const req = buildGoogleRequest({
      model: 'gemini-3-flash',
      prompt: 'p',
      apiKey: 'KEY',
      structuredOutput: {
        name: 'filter_response',
        schema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: 'https://example.com/filter',
          type: 'object',
          additionalProperties: false,
          required: ['verdicts'],
          properties: {
            verdicts: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['paperIndex'],
                properties: { paperIndex: { type: 'integer' } },
              },
            },
          },
        },
      },
    });
    const schema = req.body.generationConfig.responseSchema;
    // additionalProperties is stripped (v1beta responseSchema still rejects it)
    expect(schema.additionalProperties).toBeUndefined();
    expect(schema.properties.verdicts.items.additionalProperties).toBeUndefined();
    // $schema and $id are stripped
    expect(schema.$schema).toBeUndefined();
    expect(schema.$id).toBeUndefined();
    // Structural fields preserved
    expect(schema.required).toEqual(['verdicts']);
    expect(schema.properties.verdicts.items.required).toEqual(['paperIndex']);
    expect(schema.properties.verdicts.items.properties.paperIndex.type).toBe('integer');
  });

  it('converts ["T","null"] type unions to nullable: true (OpenAPI-3.0 subset)', () => {
    const req = buildGoogleRequest({
      model: 'gemini-3-flash',
      prompt: 'p',
      apiKey: 'KEY',
      structuredOutput: {
        name: 'suggest_profile',
        schema: {
          type: 'object',
          properties: {
            noChangeReason: { type: ['string', 'null'] },
            value: { type: ['number', 'null'] },
            plain: { type: 'string' },
          },
          required: ['noChangeReason', 'value', 'plain'],
        },
      },
    });
    const schema = req.body.generationConfig.responseSchema;
    expect(schema.properties.noChangeReason).toEqual({ type: 'string', nullable: true });
    expect(schema.properties.value).toEqual({ type: 'number', nullable: true });
    // Non-union type left alone
    expect(schema.properties.plain).toEqual({ type: 'string' });
  });

  it('produces a single text part when no pdfBase64', () => {
    const req = buildGoogleRequest({
      model: 'gemini-2.5-flash',
      prompt: 'Hello.',
      apiKey: 'KEY',
    });
    expect(req.body.contents[0].parts).toEqual([{ text: 'Hello.' }]);
  });

  it('appends an inlineData part after the text part when pdfBase64 is provided', () => {
    const req = buildGoogleRequest({
      model: 'gemini-2.5-flash',
      prompt: 'Analyze this.',
      apiKey: 'KEY',
      pdfBase64: 'BBBB',
    });
    expect(req.body.contents[0].parts).toEqual([
      { text: 'Analyze this.' },
      { inlineData: { mimeType: 'application/pdf', data: 'BBBB' } },
    ]);
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

  it('returns empty text and zero tokens when response is malformed', () => {
    const out = parseGoogleResponse({});
    expect(out.text).toBe('');
    expect(out.tokensIn).toBe(0);
    expect(out.tokensOut).toBe(0);
  });
});
