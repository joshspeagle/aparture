import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from '../../pages/api/fetch-arxiv.js';

// Minimal arXiv Atom XML fragment (single entry)
const SAMPLE_ARXIV_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/2504.01234v1</id>
    <title>Sample Paper Title</title>
    <summary>This is the abstract of the paper.</summary>
    <author><name>Alice Author</name></author>
    <published>2026-04-01T00:00:00Z</published>
  </entry>
</feed>`;

function createMockReqRes(body) {
  const req = { method: 'POST', body };
  const state = { statusCode: 200, jsonBody: undefined };
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(data) {
      state.jsonBody = data;
      return this;
    },
  };
  return { req, res, getResponse: () => state };
}

beforeEach(() => {
  process.env.ACCESS_PASSWORD = 'test-pw';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetch-arxiv API route', () => {
  it('returns XML on happy path when arXiv responds successfully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => SAMPLE_ARXIV_XML,
      headers: { get: () => null },
    });

    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      query: 'cat:cs.AI AND ti:interpretability',
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(typeof jsonBody.xml).toBe('string');
    expect(jsonBody.xml).toContain('Sample Paper Title');
  });

  it('rejects missing or wrong password with 401', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      query: 'cat:cs.AI',
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects missing query with 400', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });

  it('rejects non-POST methods with 405', async () => {
    const { req, res, getResponse } = createMockReqRes({});
    req.method = 'GET';
    await handler(req, res);
    expect(getResponse().statusCode).toBe(405);
  });

  it('returns 429 when arXiv rate-limits the request', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: (header) => (header === 'retry-after' ? '30' : null) },
      text: async () => 'rate limited',
    });

    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      query: 'cat:cs.AI',
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(429);
    expect(jsonBody.retryAfter).toBe(30);
  });
});
