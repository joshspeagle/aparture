import { describe, test, expect } from 'vitest';
import { validateNonOverlappingChanges } from '../../../lib/profile/suggestPrompt.js';

describe('validateNonOverlappingChanges', () => {
  const baseText = 'I care about Bayesian methods for hierarchical models in astrophysics.';

  test('accepts non-overlapping replace changes', () => {
    const changes = [
      {
        id: '1',
        edit: { type: 'replace', anchor: 'Bayesian methods', content: 'probabilistic inference' },
      },
      { id: '2', edit: { type: 'replace', anchor: 'astrophysics', content: 'cosmology' } },
    ];
    expect(validateNonOverlappingChanges(changes, baseText)).toEqual({ ok: true });
  });

  test('rejects overlapping replace changes', () => {
    const changes = [
      {
        id: '1',
        edit: {
          type: 'replace',
          anchor: 'Bayesian methods for hierarchical',
          content: 'something',
        },
      },
      { id: '2', edit: { type: 'replace', anchor: 'hierarchical models', content: 'other' } },
    ];
    const result = validateNonOverlappingChanges(changes, baseText);
    expect(result.ok).toBe(false);
    expect(result.overlappingIds).toEqual(['1', '2']);
  });

  test('rejects when anchor is not found in base text', () => {
    const changes = [{ id: '1', edit: { type: 'replace', anchor: 'missing text', content: 'x' } }];
    const result = validateNonOverlappingChanges(changes, baseText);
    expect(result.ok).toBe(false);
    expect(result.missingAnchors).toEqual(['1']);
  });

  test('accepts non-overlapping delete and insert', () => {
    const changes = [
      { id: 'd1', edit: { type: 'delete', anchor: 'hierarchical ', content: '' } },
      { id: 'i1', edit: { type: 'insert', anchor: 'astrophysics', content: ' and cosmology' } },
    ];
    expect(validateNonOverlappingChanges(changes, baseText)).toEqual({ ok: true });
  });

  test('rejects overlapping delete and replace', () => {
    const changes = [
      { id: 'r1', edit: { type: 'replace', anchor: 'Bayesian methods', content: 'x' } },
      { id: 'd1', edit: { type: 'delete', anchor: 'methods for', content: '' } },
    ];
    const result = validateNonOverlappingChanges(changes, baseText);
    expect(result.ok).toBe(false);
    expect(result.overlappingIds).toHaveLength(2);
  });

  test('accepts empty changes array', () => {
    expect(validateNonOverlappingChanges([], baseText)).toEqual({ ok: true });
  });
});
