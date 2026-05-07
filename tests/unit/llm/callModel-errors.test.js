import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { callModel } from '../../../lib/llm/callModel.js';
import { ProviderError } from '../../../lib/llm/ProviderError.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchResponse({ status, headers = {}, body = '' }) {
  vi.stubGlobal('fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    text: async () => body,
    json: async () => JSON.parse(body || '{}'),
  }));
}

describe('callModel error path — ProviderError with status + retryAfterMs', () => {
  it('throws ProviderError with status 429 + retryAfterMs from Anthropic Retry-After header', async () => {
    mockFetchResponse({
      status: 429,
      headers: { 'retry-after': '45' },
      body: '{"type":"error","error":{"type":"rate_limit_error","message":"too many"}}',
    });

    let caught;
    try {
      await callModel(
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          prompt: 'hi',
          apiKey: 'sk-test',
        },
        { mode: 'live' }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect(caught.provider).toBe('anthropic');
    expect(caught.status).toBe(429);
    expect(caught.retryAfterMs).toBe(45000);
    expect(caught.providerErrorBody).toContain('rate_limit_error');
  });

  it('throws ProviderError with retryAfterMs from Google RetryInfo body', async () => {
    mockFetchResponse({
      status: 429,
      headers: {},
      body: JSON.stringify({
        error: {
          status: 'RESOURCE_EXHAUSTED',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '23s' }],
        },
      }),
    });

    let caught;
    try {
      await callModel(
        { provider: 'google', model: 'gemini-3-flash', prompt: 'hi', apiKey: 'k' },
        { mode: 'live' }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect(caught.provider).toBe('google');
    expect(caught.status).toBe(429);
    expect(caught.retryAfterMs).toBe(23000);
  });

  it('throws ProviderError with status 503 + null retryAfterMs when no signal present', async () => {
    mockFetchResponse({
      status: 503,
      headers: {},
      body: '{"error":"service unavailable"}',
    });

    let caught;
    try {
      await callModel(
        { provider: 'openai', model: 'gpt-5', prompt: 'hi', apiKey: 'sk-test' },
        { mode: 'live' }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect(caught.provider).toBe('openai');
    expect(caught.status).toBe(503);
    expect(caught.retryAfterMs).toBeNull();
  });
});
