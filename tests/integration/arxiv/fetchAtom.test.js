import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fetchAtom } from '../../../lib/arxiv/fetchAtom.js';
import { ArxivThrottledError } from '../../../lib/arxiv/errors.js';

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

function mockFetch429(retryAfter = null) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({ error: 'arXiv rate limit', upstreamStatus: 429, retryAfter }),
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

  it('throws ArxivThrottledError after retries are exhausted', async () => {
    const fetchImpl = mockFetch429();
    await expect(
      fetchAtom({ ...baseArgs, fetchImpl, sleepImpl: () => Promise.resolve() })
    ).rejects.toBeInstanceOf(ArxivThrottledError);
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
});
