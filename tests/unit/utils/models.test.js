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
  getModel,
} from '../../../utils/models.js';

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

describe('utils/models.js — DEFAULT_MODEL_ID', () => {
  it('is a registered model', () => {
    expect(MODEL_REGISTRY[DEFAULT_MODEL_ID]).toBeDefined();
    expect(getModel(DEFAULT_MODEL_ID)).toBeDefined();
  });
});
