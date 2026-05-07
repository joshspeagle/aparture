import { describe, it, expect } from 'vitest';
import { parseRouteError, RateLimitError } from '../../../lib/analyzer/RateLimitError.js';

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
