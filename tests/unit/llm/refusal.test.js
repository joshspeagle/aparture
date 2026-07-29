// Safety-classifier refusal detection across all three provider adapters,
// plus the route/client translation layer.
//
// The property under test throughout: a content refusal must be
// distinguishable from (a) a transport error, (b) a truncated response, and
// (c) a malformed-JSON parse failure — because each of those wants different
// handling, and only refusals must skip the retry ladder entirely.

import { describe, it, expect, vi } from 'vitest';
import {
  RefusalError,
  sendRefusalErrorResponse,
  normalizeRefusalCategory,
  REFUSAL_CATEGORIES,
} from '../../../lib/llm/RefusalError.js';
import { parseAnthropicResponse } from '../../../lib/llm/structured/anthropic.js';
import { parseGoogleResponse } from '../../../lib/llm/structured/google.js';
import {
  parseOpenAIResponse,
  parseOpenAIResponsesResponse,
} from '../../../lib/llm/structured/openai.js';
import { parseRouteError } from '../../../lib/analyzer/RateLimitError.js';
import {
  ContentRefusalError,
  isContentRefusal,
} from '../../../lib/analyzer/ContentRefusalError.js';

describe('normalizeRefusalCategory', () => {
  it('maps each provider vocabulary onto the canonical set', () => {
    expect(normalizeRefusalCategory('cyber')).toBe(REFUSAL_CATEGORIES.CYBER);
    expect(normalizeRefusalCategory('bio')).toBe(REFUSAL_CATEGORIES.BIO);
    expect(normalizeRefusalCategory('SAFETY')).toBe(REFUSAL_CATEGORIES.SAFETY);
    expect(normalizeRefusalCategory('PROHIBITED_CONTENT')).toBe(REFUSAL_CATEGORIES.PROHIBITED);
    expect(normalizeRefusalCategory('content_filter')).toBe(REFUSAL_CATEGORIES.SAFETY);
  });

  it('degrades an unrecognised category to unknown rather than throwing', () => {
    // Providers add categories without warning; an unmapped one must still
    // produce a usable refusal, with the original preserved in `raw`.
    expect(normalizeRefusalCategory('some_future_category')).toBe(REFUSAL_CATEGORIES.UNKNOWN);
    expect(normalizeRefusalCategory(null)).toBe(REFUSAL_CATEGORIES.UNKNOWN);
  });
});

describe('Anthropic refusal detection', () => {
  it('throws RefusalError on stop_reason "refusal" with an empty content array', () => {
    // The pre-output shape: HTTP 200, no content at all. Without detection
    // this returns {text: '', structured: undefined} and blows up later as
    // an opaque validation failure.
    expect(() =>
      parseAnthropicResponse({
        model: 'claude-opus-5',
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: 'declined' },
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
      })
    ).toThrow(RefusalError);
  });

  it('carries provider, model, normalized category and raw reason', () => {
    try {
      parseAnthropicResponse({
        model: 'claude-fable-5',
        stop_reason: 'refusal',
        stop_details: { category: 'bio' },
        content: [],
      });
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(RefusalError);
      expect(err.provider).toBe('anthropic');
      expect(err.model).toBe('claude-fable-5');
      expect(err.category).toBe(REFUSAL_CATEGORIES.BIO);
      expect(err.raw).toBe('bio');
    }
  });

  it('treats a refusal with null stop_details as a refusal, not a crash', () => {
    // stop_details is documented as informational and can be null even on a
    // refusal — branching on it instead of stop_reason would miss this.
    try {
      parseAnthropicResponse({ stop_reason: 'refusal', stop_details: null, content: [] });
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(RefusalError);
      expect(err.category).toBe(REFUSAL_CATEGORIES.UNKNOWN);
    }
  });

  it('does not fire on a normal end_turn response', () => {
    const out = parseAnthropicResponse({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'hello' }],
      usage: { input_tokens: 3, output_tokens: 2 },
    });
    expect(out.text).toBe('hello');
  });
});

describe('Google refusal detection', () => {
  it('throws RefusalError on a promptFeedback blockReason', () => {
    try {
      parseGoogleResponse({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] });
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(RefusalError);
      expect(err.provider).toBe('google');
      expect(err.category).toBe(REFUSAL_CATEGORIES.SAFETY);
    }
  });

  it('throws RefusalError on a safety finishReason', () => {
    try {
      parseGoogleResponse({ candidates: [{ finishReason: 'PROHIBITED_CONTENT', content: {} }] });
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(RefusalError);
      expect(err.raw).toBe('PROHIBITED_CONTENT');
    }
  });

  it('fires even when the caller did not ask for structured output', () => {
    // Regression: safety handling used to live inside the expectStructured
    // branch, so a text-only call silently returned '' on a safety block.
    expect(() =>
      parseGoogleResponse({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }, {})
    ).toThrow(RefusalError);
  });

  it('does NOT treat MAX_TOKENS as a refusal', () => {
    // Truncation is a budget problem, fixable by retrying with a larger
    // maxTokens — classifying it as a refusal would both skip the retry that
    // would have worked and tell the user their content was rejected.
    let caught;
    try {
      parseGoogleResponse(
        { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] },
        { expectStructured: true }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught).not.toBeInstanceOf(RefusalError);
    expect(caught.message).toContain('MAX_TOKENS');
  });

  it('does not fire on a normal STOP response', () => {
    const out = parseGoogleResponse({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }],
    });
    expect(out.text).toBe('ok');
  });
});

describe('OpenAI refusal detection', () => {
  it('throws on finish_reason content_filter (Chat Completions)', () => {
    expect(() =>
      parseOpenAIResponse({
        model: 'gpt-5.6-sol',
        choices: [{ finish_reason: 'content_filter', message: { content: null } }],
      })
    ).toThrow(RefusalError);
  });

  it('throws on a non-null message.refusal (Chat Completions)', () => {
    try {
      parseOpenAIResponse({
        model: 'gpt-5.6-sol',
        choices: [{ finish_reason: 'stop', message: { refusal: "I can't help with that" } }],
      });
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(RefusalError);
      expect(err.explanation).toBe("I can't help with that");
    }
  });

  it('throws on a refusal content block (Responses API)', () => {
    expect(() =>
      parseOpenAIResponsesResponse({
        model: 'gpt-5.6-sol',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'declined' }] }],
      })
    ).toThrow(RefusalError);
  });

  it('does not fire on a normal completion', () => {
    const out = parseOpenAIResponse({
      choices: [{ finish_reason: 'stop', message: { content: 'hi', refusal: null } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    expect(out.text).toBe('hi');
  });
});

describe('sendRefusalErrorResponse', () => {
  function mockRes() {
    const res = { statusCode: null, body: null };
    res.status = vi.fn((code) => {
      res.statusCode = code;
      return res;
    });
    res.json = vi.fn((body) => {
      res.body = body;
    });
    return res;
  }

  it('sends 422 with the CONTENT_REFUSAL discriminator', () => {
    const res = mockRes();
    const handled = sendRefusalErrorResponse(
      res,
      new RefusalError({ provider: 'anthropic', model: 'claude-opus-5', raw: 'cyber' })
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(422);
    // 422 is shared with PLAYWRIGHT_UNAVAILABLE_RECAPTCHA, so the code is
    // what the client discriminates on.
    expect(res.body.code).toBe('CONTENT_REFUSAL');
    expect(res.body.category).toBe(REFUSAL_CATEGORIES.CYBER);
  });

  it('returns false for a non-refusal error so callers fall through', () => {
    const res = mockRes();
    expect(sendRefusalErrorResponse(res, new Error('boom'))).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('parseRouteError → ContentRefusalError', () => {
  const routeResponse = (status, body) => ({ status, json: async () => body });

  it('translates 422 + CONTENT_REFUSAL into a typed client error', async () => {
    await expect(
      parseRouteError(
        routeResponse(422, {
          code: 'CONTENT_REFUSAL',
          provider: 'anthropic',
          model: 'claude-opus-5',
          category: 'cyber',
          raw: 'cyber',
          error: 'anthropic declined this request (cyber)',
        }),
        'anthropic'
      )
    ).rejects.toBeInstanceOf(ContentRefusalError);
  });

  it('leaves a 422 WITHOUT the code as a generic error', async () => {
    // PLAYWRIGHT_UNAVAILABLE_RECAPTCHA also uses 422; the two must not
    // collide.
    await expect(
      parseRouteError(routeResponse(422, { error: 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA' }), 'google')
    ).rejects.not.toBeInstanceOf(ContentRefusalError);
  });

  it('still classifies 429 as a rate limit, not a refusal', async () => {
    await expect(
      parseRouteError(routeResponse(429, { provider: 'google', retryAfterMs: 1000 }), 'google')
    ).rejects.not.toBeInstanceOf(ContentRefusalError);
  });
});

describe('isContentRefusal', () => {
  it('recognises the typed error', () => {
    expect(isContentRefusal(new ContentRefusalError({ provider: 'google' }))).toBe(true);
  });

  it('recognises a refusal re-wrapped in a generic Error', () => {
    // makeRobustAPICall stringifies the last error after exhausting its
    // ladder, so the code has to survive in message form too.
    expect(isContentRefusal(new Error('All retries failed: CONTENT_REFUSAL'))).toBe(true);
  });

  it('is false for unrelated errors and nullish input', () => {
    expect(isContentRefusal(new Error('network down'))).toBe(false);
    expect(isContentRefusal(null)).toBe(false);
  });
});
