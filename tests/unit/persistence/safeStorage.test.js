import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isQuotaError, safeSetItem, stripFields } from '../../../lib/persistence/safeStorage.js';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isQuotaError', () => {
  it('detects QuotaExceededError by name', () => {
    const err = new Error('quota');
    err.name = 'QuotaExceededError';
    expect(isQuotaError(err)).toBe(true);
  });

  it('detects Firefox NS_ERROR_DOM_QUOTA_REACHED by name', () => {
    const err = new Error('quota');
    err.name = 'NS_ERROR_DOM_QUOTA_REACHED';
    expect(isQuotaError(err)).toBe(true);
  });

  it('detects legacy code 22 / 1014', () => {
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError({ code: 1014 })).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(isQuotaError(new Error('boom'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

describe('safeSetItem', () => {
  it('returns true on successful write', () => {
    expect(safeSetItem('k', 'v')).toBe(true);
    expect(window.localStorage.getItem('k')).toBe('v');
  });

  it('returns false on QuotaExceededError without throwing', () => {
    const err = new DOMException('quota', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw err;
    });
    expect(safeSetItem('k', 'v')).toBe(false);
  });

  it('rethrows non-quota errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('other');
    });
    expect(() => safeSetItem('k', 'v')).toThrow('other');
  });
});

describe('stripFields', () => {
  it('drops top-level fields', () => {
    const out = stripFields({ a: 1, b: 2, c: 3 }, ['b']);
    expect(out).toEqual({ a: 1, c: 3 });
  });

  it('drops nested fields via dotted path', () => {
    const out = stripFields(
      { results: { allPapers: [1, 2, 3], finalRanking: [9] }, config: { x: 1 } },
      ['results.allPapers']
    );
    expect(out).toEqual({ results: { finalRanking: [9] }, config: { x: 1 } });
  });

  it('does not mutate input', () => {
    const input = { results: { allPapers: [1] } };
    stripFields(input, ['results.allPapers']);
    expect(input.results.allPapers).toEqual([1]);
  });

  it('is a no-op for missing paths', () => {
    const out = stripFields({ a: 1 }, ['b.c.d']);
    expect(out).toEqual({ a: 1 });
  });
});
