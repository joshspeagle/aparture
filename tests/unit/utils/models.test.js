// Enforces the "always update together" invariant between MODEL_REGISTRY and
// AVAILABLE_MODELS in utils/models.js, plus per-entry shape requirements
// (apiId, provider, and explicit pricing fields). This is the test that would
// have caught the retired-model rot class (a registry ID going live-404 while
// still selectable in the UI, or a UI entry with no registry mapping).

import { describe, it, expect } from 'vitest';
import {
  MODEL_REGISTRY,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  effectivePricing,
  getModel,
  supportsAdaptiveThinkingByApiId,
} from '../../../utils/models.js';
import { RETIRED_MODEL_REMAP } from '../../../hooks/useAnalyzerPersistence.js';

describe('utils/models.js — registry ↔ UI-list consistency', () => {
  it('every AVAILABLE_MODELS id has a MODEL_REGISTRY entry', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(
        MODEL_REGISTRY[model.id],
        `AVAILABLE_MODELS id "${model.id}" missing from registry`
      ).toBeDefined();
    }
  });

  it('every MODEL_REGISTRY id has an AVAILABLE_MODELS entry', () => {
    for (const id of Object.keys(MODEL_REGISTRY)) {
      expect(getModel(id), `MODEL_REGISTRY id "${id}" missing from AVAILABLE_MODELS`).toBeDefined();
    }
  });

  it('has no duplicate ids in AVAILABLE_MODELS', () => {
    const ids = AVAILABLE_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('registry and UI list agree on provider for every model', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(MODEL_REGISTRY[model.id].provider, `provider mismatch for "${model.id}"`).toBe(
        model.provider
      );
    }
  });
});

describe('utils/models.js — per-entry required fields', () => {
  it('every registry entry has a non-empty apiId and a known provider', () => {
    const knownProviders = new Set(['Anthropic', 'OpenAI', 'Google']);
    for (const [id, entry] of Object.entries(MODEL_REGISTRY)) {
      expect(typeof entry.apiId, `apiId missing for "${id}"`).toBe('string');
      expect(entry.apiId.length, `apiId empty for "${id}"`).toBeGreaterThan(0);
      expect(knownProviders.has(entry.provider), `unknown provider for "${id}"`).toBe(true);
    }
  });

  it('every registry entry has explicit pricing fields (number or explicit null, never guessed)', () => {
    for (const [id, entry] of Object.entries(MODEL_REGISTRY)) {
      for (const field of ['inputPerMTok', 'outputPerMTok']) {
        expect(field in entry, `${field} absent for "${id}" — set a value or explicit null`).toBe(
          true
        );
        const value = entry[field];
        const ok = value === null || (typeof value === 'number' && value > 0);
        expect(ok, `${field} for "${id}" must be a positive number or null (got ${value})`).toBe(
          true
        );
      }
    }
  });

  it('every Anthropic registry entry declares supportsAdaptiveThinking; non-Anthropic entries omit it', () => {
    // The Anthropic adapter's thinking gate is registry-driven
    // (lib/llm/structured/anthropic.js): a missing flag on an Anthropic entry
    // would silently push that model onto the version-regex fallback. The
    // flag is meaningless for other providers, so they must omit it (see the
    // MODEL_REGISTRY header comment).
    for (const [id, entry] of Object.entries(MODEL_REGISTRY)) {
      if (entry.provider === 'Anthropic') {
        expect(
          typeof entry.supportsAdaptiveThinking,
          `supportsAdaptiveThinking missing (or non-boolean) for Anthropic entry "${id}"`
        ).toBe('boolean');
      } else {
        expect(
          'supportsAdaptiveThinking' in entry,
          `supportsAdaptiveThinking must be omitted on non-Anthropic entry "${id}"`
        ).toBe(false);
      }
    }
  });

  it('every AVAILABLE_MODELS entry carries UI metadata (name, capability flags, apiKeyEnv)', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(typeof model.name, `name missing for "${model.id}"`).toBe('string');
      expect(typeof model.supportsPDF, `supportsPDF missing for "${model.id}"`).toBe('boolean');
      expect(
        typeof model.supportsQuickFilter,
        `supportsQuickFilter missing for "${model.id}"`
      ).toBe('boolean');
      expect(typeof model.description, `description missing for "${model.id}"`).toBe('string');
      expect(typeof model.apiKeyEnv, `apiKeyEnv missing for "${model.id}"`).toBe('string');
    }
  });
});

describe('utils/models.js — supportsAdaptiveThinkingByApiId', () => {
  it('resolves registered Anthropic apiIds to their flag', () => {
    expect(supportsAdaptiveThinkingByApiId('claude-opus-5-5')).toBe(true);
    expect(supportsAdaptiveThinkingByApiId('claude-sonnet-5-5')).toBe(true);
    expect(supportsAdaptiveThinkingByApiId('claude-haiku-5-5')).toBe(true);
    expect(supportsAdaptiveThinkingByApiId('claude-haiku-4-5')).toBe(false);
  });

  it('accepts dotted user-facing registry keys as a fallback', () => {
    // 'claude-opus-5.5' is a registry KEY whose apiId is 'claude-opus-5-5';
    // callers occasionally pass the user-facing form straight through.
    expect(supportsAdaptiveThinkingByApiId('claude-opus-5.5')).toBe(true);
    expect(supportsAdaptiveThinkingByApiId('claude-haiku-4.5')).toBe(false);
  });

  it('returns undefined for unregistered ids so callers can fall back', () => {
    expect(supportsAdaptiveThinkingByApiId('claude-opus-4-5')).toBeUndefined();
    expect(supportsAdaptiveThinkingByApiId('gpt-5.6-sol')).toBeUndefined();
    expect(supportsAdaptiveThinkingByApiId('')).toBeUndefined();
    expect(supportsAdaptiveThinkingByApiId(undefined)).toBeUndefined();
  });
});

describe('utils/models.js — DEFAULT_MODEL_ID', () => {
  it('is a registered model', () => {
    expect(MODEL_REGISTRY[DEFAULT_MODEL_ID]).toBeDefined();
    expect(getModel(DEFAULT_MODEL_ID)).toBeDefined();
  });
});

describe('utils/models.js — promo pricing', () => {
  it('every promo block is well-formed and cheaper than list price', () => {
    for (const [id, entry] of Object.entries(MODEL_REGISTRY)) {
      if (!entry.promo) continue;
      expect(entry.promo.until, `promo.until for "${id}"`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.promo.inputPerMTok).toBeLessThanOrEqual(entry.inputPerMTok);
      expect(entry.promo.outputPerMTok).toBeLessThanOrEqual(entry.outputPerMTok);
    }
  });

  it('applies the promo price through its end date and list price after', () => {
    const entry = {
      inputPerMTok: 4,
      outputPerMTok: 20,
      promo: { inputPerMTok: 2, outputPerMTok: 10, until: '2026-11-30' },
    };
    expect(effectivePricing(entry, new Date('2026-11-30T23:00:00Z'))).toEqual({
      inputPerMTok: 2,
      outputPerMTok: 10,
      promo: true,
    });
    expect(effectivePricing(entry, new Date('2026-12-01T00:00:00Z'))).toEqual({
      inputPerMTok: 4,
      outputPerMTok: 20,
      promo: false,
    });
    expect(effectivePricing({ inputPerMTok: null, outputPerMTok: 1 })).toBeNull();
    expect(effectivePricing(undefined)).toBeNull();
  });
});

describe('RETIRED_MODEL_REMAP', () => {
  it('maps only unregistered ids, and only to registered ones', () => {
    for (const [from, to] of Object.entries(RETIRED_MODEL_REMAP)) {
      expect(
        MODEL_REGISTRY[from],
        `"${from}" is still registered; drop it from the remap`
      ).toBeUndefined();
      expect(MODEL_REGISTRY[to], `"${from}" maps to unregistered "${to}"`).toBeDefined();
    }
  });
});
