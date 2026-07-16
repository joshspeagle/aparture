// providerKeyForModel must land on the SAME barrier key the routes signal on
// a 429: the routes resolve provider as `MODEL_REGISTRY[id]?.provider ??
// 'Google'` (lowercased downstream), so the client-side acquire key mirrors
// exactly that — registry provider, else 'google'. A prefix-inference
// ('claude…' → anthropic) would acquire a barrier no route ever signals.

import { describe, it, expect } from 'vitest';
import { providerKeyForModel } from '../../../lib/analyzer/stages/support.js';
import { providerForModel, MODEL_REGISTRY } from '../../../utils/models.js';

describe('providerForModel (utils/models.js)', () => {
  it('returns the registry provider for registered ids', () => {
    expect(providerForModel('claude-haiku-4.5')).toBe('Anthropic');
    expect(providerForModel('gemini-3.5-flash')).toBe('Google');
    expect(providerForModel('gpt-5.4-nano')).toBe('OpenAI');
  });

  it('returns null for unregistered ids', () => {
    expect(providerForModel('claude-opus-4.5')).toBeNull(); // retired 2026-07
    expect(providerForModel('totally-made-up')).toBeNull();
    expect(providerForModel(undefined)).toBeNull();
  });
});

describe('providerKeyForModel (stages/support.js)', () => {
  it('lowercases the registry provider for registered ids', () => {
    expect(providerKeyForModel('claude-haiku-4.5')).toBe('anthropic');
    expect(providerKeyForModel('gemini-3.5-flash')).toBe('google');
    expect(providerKeyForModel('gpt-5.4-nano')).toBe('openai');
  });

  it("falls back to 'google' for unregistered ids — matching the routes' ?? 'Google'", () => {
    // Even provider-suggestive prefixes must NOT be inferred: the route the
    // request actually hits treats an unregistered id as Google, and the
    // barrier key has to match what parseRouteError will signal.
    expect(MODEL_REGISTRY['claude-imaginary-9']).toBeUndefined();
    expect(providerKeyForModel('claude-imaginary-9')).toBe('google');
    expect(providerKeyForModel('gpt-99')).toBe('google');
    expect(providerKeyForModel('')).toBe('google');
    expect(providerKeyForModel(undefined)).toBe('google');
  });
});
