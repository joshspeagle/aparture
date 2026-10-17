import { describe, it, expect } from 'vitest';
import {
  parseRouteError,
  RateLimitError,
  NonRetryableRouteError,
  isNonRetryableError,
} from '../../../lib/analyzer/RateLimitError.js';

function mockResponse({ status, body }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  };
}

describe('parseRouteError', () => {
  it('throws RateLimitError on 429 with retryAfterMs from body', async () => {
    let caught;
    try {
      await parseRouteError(
        mockResponse({
          status: 429,
          body: {
            error: 'google: rate limited (429)',
            details: 'RESOURCE_EXHAUSTED',
            retryAfterMs: 23000,
            provider: 'google',
          },
        }),
        'google'
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect(caught.provider).toBe('google');
    expect(caught.status).toBe(429);
    expect(caught.retryAfterMs).toBe(23000);
    expect(caught.message).toMatch(/retry in 23s/);
  });

  it('throws RateLimitError on 503 even without retryAfterMs', async () => {
    let caught;
    try {
      await parseRouteError(
        mockResponse({ status: 503, body: { error: 'overloaded' } }),
        'anthropic'
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect(caught.status).toBe(503);
    expect(caught.retryAfterMs).toBeNull();
  });

  it('throws plain Error with details for non-rate-limit failures', async () => {
    let caught;
    try {
      await parseRouteError(
        mockResponse({
          status: 400,
          body: { error: 'Invalid request', details: 'google: invalid argument' },
        }),
        'google'
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(RateLimitError);
    // Surfaces actual provider message, not the generic route error
    expect(caught.message).toBe('google: invalid argument');
  });

  it('uses fallback provider when body lacks one', async () => {
    let caught;
    try {
      await parseRouteError(mockResponse({ status: 429, body: { error: 'limit' } }), 'openai');
    } catch (err) {
      caught = err;
    }
    expect(caught.provider).toBe('openai');
  });

  it('falls back to status-based message when body is empty/non-JSON', async () => {
    const res = {
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    };
    let caught;
    try {
      await parseRouteError(res, 'google');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toContain('500');
  });
});

describe('parseRouteError — retry classification', () => {
  const catchFrom = async (status, body, provider = 'anthropic') => {
    try {
      await parseRouteError(mockResponse({ status, body }), provider);
    } catch (err) {
      return err;
    }
    throw new Error('parseRouteError did not throw');
  };

  it('treats Anthropic 529 (overloaded) like 429/503: a RateLimitError', async () => {
    const err = await catchFrom(529, { error: 'Overloaded', provider: 'anthropic' });
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.status).toBe(529);
    expect(err.message).toMatch(/overloaded \(529\)/);
    expect(isNonRetryableError(err)).toBe(false);
  });

  it.each([400, 401, 403, 404, 413])('marks HTTP %i non-retryable', async (status) => {
    const err = await catchFrom(status, { error: 'route error', details: 'provider said no' });
    expect(err).toBeInstanceOf(NonRetryableRouteError);
    expect(err.status).toBe(status);
    expect(err.retryable).toBe(false);
    expect(err.message).toBe('provider said no');
  });

  it('marks a 422 that is not a CONTENT_REFUSAL non-retryable', async () => {
    const err = await catchFrom(422, { error: 'unprocessable' });
    expect(err).toBeInstanceOf(NonRetryableRouteError);
    expect(err.message).toBe('unprocessable');
  });

  it("surfaces the provider's own message from a JSON error body", async () => {
    const err = await catchFrom(401, {
      error: 'anthropic request failed (401)',
      details: JSON.stringify({
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' },
      }),
      provider: 'anthropic',
    });
    expect(err.message).toBe('anthropic: invalid x-api-key');
  });

  it('keeps 5xx (and 502 validation failures) retryable', async () => {
    for (const status of [500, 502]) {
      const err = await catchFrom(status, { error: 'model did not return structured output' });
      expect(err).not.toBeInstanceOf(NonRetryableRouteError);
      expect(err.status).toBe(status);
      expect(isNonRetryableError(err)).toBe(false);
    }
  });
});
