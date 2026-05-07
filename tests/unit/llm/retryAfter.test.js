import { describe, it, expect, vi } from 'vitest';
import {
  parseRetryAfterHeader,
  parseGoogleRetryDelay,
  parseProviderRetryAfter,
} from '../../../lib/llm/retryAfter.js';

describe('parseRetryAfterHeader', () => {
  it('parses delta-seconds form', () => {
    expect(parseRetryAfterHeader('30')).toBe(30000);
    expect(parseRetryAfterHeader('0')).toBe(0);
    expect(parseRetryAfterHeader('120')).toBe(120000);
  });

  it('parses HTTP-date form as ms-from-now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T07:27:00Z'));
    const ms = parseRetryAfterHeader('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(ms).toBe(60000);
    vi.useRealTimers();
  });

  it('returns null for null/empty input', () => {
    expect(parseRetryAfterHeader(null)).toBeNull();
    expect(parseRetryAfterHeader(undefined)).toBeNull();
    expect(parseRetryAfterHeader('')).toBeNull();
  });

  it('returns null for unparseable strings', () => {
    expect(parseRetryAfterHeader('not a number or date')).toBeNull();
  });

  it('clamps negative HTTP-date deltas to 0', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T07:30:00Z'));
    const ms = parseRetryAfterHeader('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(ms).toBe(0);
    vi.useRealTimers();
  });
});

describe('parseGoogleRetryDelay', () => {
  it('parses RetryInfo body with whole-second delay', () => {
    const body = JSON.stringify({
      error: {
        status: 'RESOURCE_EXHAUSTED',
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '23s' }],
      },
    });
    expect(parseGoogleRetryDelay(body)).toBe(23000);
  });

  it('parses fractional-second delay', () => {
    const body = JSON.stringify({
      error: {
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '1.5s' }],
      },
    });
    expect(parseGoogleRetryDelay(body)).toBe(1500);
  });

  it('returns null when no RetryInfo present', () => {
    const body = JSON.stringify({
      error: {
        status: 'INVALID_ARGUMENT',
        details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest' }],
      },
    });
    expect(parseGoogleRetryDelay(body)).toBeNull();
  });

  it('returns null for unparseable JSON', () => {
    expect(parseGoogleRetryDelay('not json')).toBeNull();
  });

  it('returns null for empty/null input', () => {
    expect(parseGoogleRetryDelay(null)).toBeNull();
    expect(parseGoogleRetryDelay('')).toBeNull();
  });

  it('returns null when retryDelay is missing the trailing s', () => {
    const body = JSON.stringify({
      error: {
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '23' }],
      },
    });
    expect(parseGoogleRetryDelay(body)).toBeNull();
  });
});

describe('parseProviderRetryAfter', () => {
  function mockResponse(headers = {}) {
    return {
      headers: {
        get(name) {
          return headers[name.toLowerCase()] ?? null;
        },
      },
    };
  }

  it('uses header path for anthropic', () => {
    const ms = parseProviderRetryAfter('anthropic', mockResponse({ 'retry-after': '45' }), null);
    expect(ms).toBe(45000);
  });

  it('uses header path for openai', () => {
    const ms = parseProviderRetryAfter('openai', mockResponse({ 'retry-after': '12' }), null);
    expect(ms).toBe(12000);
  });

  it('uses body path for google (ignores headers)', () => {
    const body = JSON.stringify({
      error: {
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '7s' }],
      },
    });
    const ms = parseProviderRetryAfter(
      'google',
      mockResponse({ 'retry-after': '99' }), // would-be header is ignored
      body
    );
    expect(ms).toBe(7000);
  });

  it('returns null when no signal present', () => {
    expect(parseProviderRetryAfter('anthropic', mockResponse({}), null)).toBeNull();
    expect(parseProviderRetryAfter('google', mockResponse({}), '{}')).toBeNull();
  });
});
