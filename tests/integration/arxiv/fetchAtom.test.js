import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fetchAtom } from '../../../lib/arxiv/fetchAtom.js';
import {
  ArxivThrottledError,
  ArxivNetworkError,
  ArxivParseError,
} from '../../../lib/arxiv/errors.js';

const ATOM_XML = fs.readFileSync(
  path.resolve('tests/fixtures/arxiv/atom-cs.AI-2026-04-29.xml'),
  'utf8'
);

function mockFetchOk(xml) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ xml }),
  });
}

const baseArgs = {
  subcategory: 'cs.AI',
  from: '2026-04-28',
  until: '2026-04-29',
  password: 'test-pw',
  abortSignal: { aborted: false },
  statusCallback: () => {},
};

describe('fetchAtom', () => {
  it('parses papers on a successful response', async () => {
    const fetchImpl = mockFetchOk(ATOM_XML);
    const papers = await fetchAtom({ ...baseArgs, fetchImpl });

    expect(papers).toHaveLength(2);
    expect(papers[0].id).toBe('2604.10001');
    expect(papers[0].fetchedCategory).toBe('cs.AI');
  });

  it('builds the expected /api/fetch-arxiv body', async () => {
    const fetchImpl = mockFetchOk(ATOM_XML);
    await fetchAtom({ ...baseArgs, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/fetch-arxiv',
      expect.objectContaining({
        method: 'POST',
      })
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.password).toBe('test-pw');
    expect(body.query).toBe('(cat:cs.AI) AND submittedDate:[20260428 TO 20260429]');
  });

  it('throws ArxivThrottledError after retries are exhausted, carrying upstreamStatus and retryAfter', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'arXiv rate limit', upstreamStatus: 503, retryAfter: 7 }),
    });
    let caught;
    try {
      await fetchAtom({ ...baseArgs, fetchImpl, sleepImpl: () => Promise.resolve() });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ArxivThrottledError);
    // upstream 503 was rewritten to 429-shape by the proxy; surface the upstream code
    expect(caught.upstreamStatus).toBe(503);
    expect(caught.retryAfter).toBe(7);
    // 1 initial + 3 retries = 4 calls total
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('honors abort signal between retries', async () => {
    const signal = { aborted: false };
    const fetchImpl = vi.fn().mockImplementation(async () => {
      signal.aborted = true;
      return { ok: false, status: 429, json: async () => ({ error: 'arXiv rate limit' }) };
    });
    await expect(
      fetchAtom({ ...baseArgs, abortSignal: signal, fetchImpl, sleepImpl: () => Promise.resolve() })
    ).rejects.toThrow(/aborted/i);
  });

  it('throws ArxivNetworkError on non-429 non-OK responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal proxy error' }),
    });
    await expect(fetchAtom({ ...baseArgs, fetchImpl })).rejects.toBeInstanceOf(ArxivNetworkError);
  });

  it('throws ArxivParseError when arXiv returns an <error> element', async () => {
    const errXml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><error>malformed query</error></feed>`;
    const fetchImpl = mockFetchOk(errXml);
    await expect(fetchAtom({ ...baseArgs, fetchImpl })).rejects.toBeInstanceOf(ArxivParseError);
  });
});
