import { describe, it, expect } from 'vitest';
import { isPlausibleApiKey } from '../../../lib/auth/apiKeyShape.js';

describe('isPlausibleApiKey', () => {
  it('accepts each provider’s published key shape', () => {
    expect(isPlausibleApiKey('anthropic', `sk-ant-api03-${'a'.repeat(40)}`)).toBe(true);
    expect(isPlausibleApiKey('openai', `sk-proj-${'b'.repeat(40)}`)).toBe(true);
    expect(isPlausibleApiKey('openai', `sk-${'c'.repeat(48)}`)).toBe(true);
    expect(isPlausibleApiKey('google', `AIza${'d'.repeat(35)}`)).toBe(true);
  });

  it('rejects junk, empty and non-string keys', () => {
    for (const key of ['x', '', '   ', 'test-api-key', null, undefined, 42]) {
      expect(isPlausibleApiKey('anthropic', key)).toBe(false);
    }
  });

  it('rejects a key shaped for a different provider', () => {
    expect(isPlausibleApiKey('anthropic', `AIza${'d'.repeat(35)}`)).toBe(false);
    expect(isPlausibleApiKey('google', `sk-ant-api03-${'a'.repeat(40)}`)).toBe(false);
  });

  it('rejects unknown providers', () => {
    expect(isPlausibleApiKey('xai', `sk-${'a'.repeat(40)}`)).toBe(false);
  });
});
