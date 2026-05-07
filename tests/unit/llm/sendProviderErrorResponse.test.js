import { describe, it, expect } from 'vitest';
import { ProviderError, sendProviderErrorResponse } from '../../../lib/llm/ProviderError.js';

function mockRes() {
  const state = { statusCode: undefined, body: undefined };
  return {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(data) {
      state.body = data;
      return this;
    },
    _state: state,
  };
}

describe('sendProviderErrorResponse', () => {
  it('returns true and writes 429 + retryAfterMs + details for a Google ProviderError', () => {
    const res = mockRes();
    const err = new ProviderError({
      provider: 'google',
      status: 429,
      providerErrorBody: '{"error":{"status":"RESOURCE_EXHAUSTED"}}',
      retryAfterMs: 23000,
    });
    expect(sendProviderErrorResponse(res, err)).toBe(true);
    expect(res._state.statusCode).toBe(429);
    expect(res._state.body.error).toContain('google');
    expect(res._state.body.retryAfterMs).toBe(23000);
    expect(res._state.body.details).toContain('RESOURCE_EXHAUSTED');
    expect(res._state.body.provider).toBe('google');
  });

  it('returns true and writes 503 with null retryAfterMs', () => {
    const res = mockRes();
    const err = new ProviderError({ provider: 'openai', status: 503 });
    expect(sendProviderErrorResponse(res, err)).toBe(true);
    expect(res._state.statusCode).toBe(503);
    expect(res._state.body.retryAfterMs).toBeNull();
  });

  it('returns false for a plain Error (caller falls through to 500)', () => {
    const res = mockRes();
    expect(sendProviderErrorResponse(res, new Error('something else'))).toBe(false);
    expect(res._state.statusCode).toBeUndefined();
  });

  it('returns false for null/undefined error', () => {
    const res = mockRes();
    expect(sendProviderErrorResponse(res, null)).toBe(false);
    expect(sendProviderErrorResponse(res, undefined)).toBe(false);
  });
});
