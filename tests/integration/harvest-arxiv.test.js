import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from '../../pages/api/harvest-arxiv.js';

const SAMPLE_OAI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH><ListRecords>
  <record><header><identifier>oai:arXiv.org:2604.0001</identifier></header></record>
  <resumptionToken></resumptionToken>
</ListRecords></OAI-PMH>`;

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

describe('harvest-arxiv API route', () => {
  it('returns XML on happy path', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => SAMPLE_OAI_XML,
      headers: { get: () => null },
    });

    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      metadataPrefix: 'arXiv',
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody.xml).toContain('2604.0001');
    expect(jsonBody.resumptionToken).toBe('');
  });

  it('rejects request with wrong password', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      metadataPrefix: 'arXiv',
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('uses resumptionToken when provided (ignores other params)', async () => {
    let capturedUrl;
    vi.spyOn(global, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        text: async () => SAMPLE_OAI_XML,
        headers: { get: () => null },
      };
    });

    const { req, res } = createMockReqRes({
      password: 'test-pw',
      resumptionToken: 'abc123',
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      metadataPrefix: 'arXiv',
    });
    await handler(req, res);

    expect(capturedUrl).toContain('verb=ListRecords');
    expect(capturedUrl).toContain('resumptionToken=abc123');
    expect(capturedUrl).not.toContain('from=');
    expect(capturedUrl).not.toContain('set=');
  });

  it('maps upstream 429 to 429 response with retryAfter', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => '',
      headers: { get: (h) => (h === 'retry-after' ? '12' : null) },
    });

    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      metadataPrefix: 'arXiv',
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(429);
    expect(jsonBody.upstreamStatus).toBe(429);
    expect(jsonBody.retryAfter).toBe(12);
  });

  it('extracts <resumptionToken> from response', async () => {
    const xmlWithToken = SAMPLE_OAI_XML.replace(
      '<resumptionToken></resumptionToken>',
      '<resumptionToken>tokABC</resumptionToken>'
    );
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => xmlWithToken,
      headers: { get: () => null },
    });

    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      metadataPrefix: 'arXiv',
    });
    await handler(req, res);
    expect(getResponse().jsonBody.resumptionToken).toBe('tokABC');
  });
});
