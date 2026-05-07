import { describe, it, expect } from 'vitest';
import { ProviderError } from '../../../lib/llm/ProviderError.js';

describe('ProviderError', () => {
  it('preserves provider, status, body, retryAfterMs', () => {
    const err = new ProviderError({
      provider: 'google',
      status: 429,
      providerErrorBody: '{"error":{"status":"RESOURCE_EXHAUSTED"}}',
      retryAfterMs: 23000,
    });
    expect(err.provider).toBe('google');
    expect(err.status).toBe(429);
    expect(err.providerErrorBody).toBe('{"error":{"status":"RESOURCE_EXHAUSTED"}}');
    expect(err.retryAfterMs).toBe(23000);
    expect(err.name).toBe('ProviderError');
  });

  it('defaults message to "<provider> request failed (<status>)"', () => {
    const err = new ProviderError({ provider: 'anthropic', status: 503 });
    expect(err.message).toBe('anthropic request failed (503)');
  });

  it('accepts a custom message', () => {
    const err = new ProviderError({
      provider: 'openai',
      status: 400,
      message: 'invalid argument',
    });
    expect(err.message).toBe('invalid argument');
  });

  it('treats missing retryAfterMs as null', () => {
    const err = new ProviderError({ provider: 'openai', status: 500 });
    expect(err.retryAfterMs).toBeNull();
  });

  it('is catchable as Error and instanceof check works', () => {
    try {
      throw new ProviderError({ provider: 'google', status: 429 });
    } catch (err) {
      expect(err instanceof Error).toBe(true);
      expect(err instanceof ProviderError).toBe(true);
    }
  });
});
