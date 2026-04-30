import { describe, it, expect } from 'vitest';
import { prefixOf, narrowSetOf, groupByPrefix } from '../../../lib/arxiv/sets.js';

describe('prefixOf', () => {
  it('returns top-level prefix for cs.AI', () => {
    expect(prefixOf('cs.AI')).toBe('cs');
  });

  it('returns top-level prefix for stat.ML', () => {
    expect(prefixOf('stat.ML')).toBe('stat');
  });

  it('returns "physics" for astro-ph.HE', () => {
    expect(prefixOf('astro-ph.HE')).toBe('physics');
  });

  it('returns "physics" for cond-mat.dis-nn', () => {
    expect(prefixOf('cond-mat.dis-nn')).toBe('physics');
  });

  it('returns "physics" for hep-th (no subcat)', () => {
    expect(prefixOf('hep-th')).toBe('physics');
  });

  it('returns "econ" for econ.GN', () => {
    expect(prefixOf('econ.GN')).toBe('econ');
  });

  it('returns "q-bio" for q-bio.NC', () => {
    expect(prefixOf('q-bio.NC')).toBe('q-bio');
  });

  it('returns null for unknown subcategory', () => {
    expect(prefixOf('foo.BAR')).toBeNull();
  });
});

describe('narrowSetOf', () => {
  it('returns cs:cs:AI for cs.AI', () => {
    expect(narrowSetOf('cs.AI')).toBe('cs:cs:AI');
  });

  it('returns physics:astro-ph:HE for astro-ph.HE', () => {
    expect(narrowSetOf('astro-ph.HE')).toBe('physics:astro-ph:HE');
  });

  it('returns physics:hep-th for hep-th', () => {
    expect(narrowSetOf('hep-th')).toBe('physics:hep-th');
  });

  it('returns null for unknown subcategory', () => {
    expect(narrowSetOf('foo.BAR')).toBeNull();
  });
});

describe('groupByPrefix', () => {
  it('groups subcategories under their prefix preserving insertion order', () => {
    const result = groupByPrefix(['cs.AI', 'stat.ML', 'cs.LG', 'astro-ph.HE']);
    expect(result).toEqual({
      cs: ['cs.AI', 'cs.LG'],
      stat: ['stat.ML'],
      physics: ['astro-ph.HE'],
    });
  });

  it('throws ArxivUnknownCategoryError for unknown subcategory', () => {
    expect(() => groupByPrefix(['cs.AI', 'foo.BAR'])).toThrowError(/foo\.BAR/);
  });
});
