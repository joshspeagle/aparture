import { describe, it, expect } from 'vitest';
import {
  ArxivThrottledError,
  ArxivNetworkError,
  ArxivParseError,
  ArxivUnknownCategoryError,
} from '../../../lib/arxiv/errors.js';

describe('arxiv error classes', () => {
  it('ArxivThrottledError carries upstreamStatus and retryAfter', () => {
    const e = new ArxivThrottledError('throttled', { upstreamStatus: 429, retryAfter: 30 });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ArxivThrottledError);
    expect(e.name).toBe('ArxivThrottledError');
    expect(e.upstreamStatus).toBe(429);
    expect(e.retryAfter).toBe(30);
  });

  it('ArxivNetworkError preserves cause', () => {
    const cause = new Error('socket hang up');
    const e = new ArxivNetworkError('network failure', { cause });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ArxivNetworkError);
    expect(e.name).toBe('ArxivNetworkError');
    expect(e.cause).toBe(cause);
  });

  it('ArxivParseError', () => {
    const e = new ArxivParseError('bad XML');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ArxivParseError);
    expect(e.name).toBe('ArxivParseError');
  });

  it('ArxivUnknownCategoryError carries the offending subcategory', () => {
    const e = new ArxivUnknownCategoryError('foo.BAR');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ArxivUnknownCategoryError);
    expect(e.name).toBe('ArxivUnknownCategoryError');
    expect(e.subcategory).toBe('foo.BAR');
    expect(e.message).toContain('foo.BAR');
  });
});
