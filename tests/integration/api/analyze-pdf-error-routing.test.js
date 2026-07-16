// Verifies analyze-pdf routes only genuine reCAPTCHA/HTML interstitials to
// the Playwright fallback (audit P1-4). Genuine download failures — 404,
// network timeout, an exhausted 429 — must propagate with their real
// message and upstream status so the client retry ladder handles them,
// instead of being funneled into PLAYWRIGHT_UNAVAILABLE_RECAPTCHA 422s
// (which short-circuit retries and read to the user as a reCAPTCHA issue).
//
// Playwright is mocked as uninstalled throughout: on the old behavior every
// one of these cases produced a 422 sentinel.

import { describe, test, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

function makeReqRes() {
  let statusCode = 200;
  let jsonBody;
  const req = {
    method: 'POST',
    body: {
      arxivId: '2501.12345',
      title: 'Test paper',
      pdfUrl: 'https://arxiv.org/pdf/2501.12345',
      scoringCriteria: 'anything',
      originalScore: 5.5,
      apiKey: 'test-api-key',
      model: 'claude-haiku-4.5',
    },
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonBody = data;
      return this;
    },
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };
  return { req, res };
}

describe('analyze-pdf — download error routing', () => {
  let originalFetch;
  let originalNodeEnv;

  beforeAll(() => {
    process.env.ACCESS_PASSWORD = 'test-password';
  });

  beforeEach(() => {
    vi.resetModules();
    originalFetch = global.fetch;
    originalNodeEnv = process.env.NODE_ENV;
    // Force non-test NODE_ENV so the _testPdfBase64 escape hatch is NOT taken
    // and the handler exercises the real download path.
    process.env.NODE_ENV = 'development';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Playwright "not installed" — the old behavior turned every failure
    // below into a 422 PLAYWRIGHT_UNAVAILABLE_RECAPTCHA via this path.
    vi.doMock('playwright', () => {
      throw new Error("Cannot find module 'playwright'");
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    vi.doUnmock('playwright');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test('HTTP 404 from arXiv propagates as 404 with the real message (not a 422)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
    }));

    const { default: handler } = await import('../../../pages/api/analyze-pdf.js');
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(404);
    expect(res.getJson().error).not.toBe('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA');
    expect(res.getJson().details).toMatch(/HTTP 404/);
  });

  test('network-level failure (timeout) propagates as 502 with the real message (not a 422)', async () => {
    global.fetch = vi.fn(async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    });

    const { default: handler } = await import('../../../pages/api/analyze-pdf.js');
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.getStatus()).toBe(502);
    expect(res.getJson().error).not.toBe('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA');
    expect(res.getJson().details).toMatch(/timeout/i);
  });

  test(
    'exhausted 429 (after the single Retry-After retry) propagates as 429',
    { timeout: 20000 },
    async () => {
      // Both attempts return 429 with Retry-After: 0 so the built-in
      // retry-once path runs without a long throttle pause.
      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 429,
        headers: { get: () => '0' },
      }));

      const { default: handler } = await import('../../../pages/api/analyze-pdf.js');
      const { req, res } = makeReqRes();
      await handler(req, res);

      // Direct fetch attempted twice (throttle + Retry-After preserved)…
      expect(global.fetch).toHaveBeenCalledTimes(2);
      // …then the real upstream status is forwarded so the client's
      // parseRouteError builds a RateLimitError and pauses siblings.
      expect(res.getStatus()).toBe(429);
      expect(res.getJson().error).not.toBe('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA');
    }
  );

  test('reCAPTCHA interstitial (OK response, non-PDF body) still routes to the Playwright path', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from('<html>CAPTCHA page</html>', 'utf-8').buffer,
    }));

    const { default: handler } = await import('../../../pages/api/analyze-pdf.js');
    const { req, res } = makeReqRes();
    await handler(req, res);

    // Playwright unavailable → structured 422 sentinel, exactly as before.
    expect(res.getStatus()).toBe(422);
    expect(res.getJson().error).toBe('PLAYWRIGHT_UNAVAILABLE_RECAPTCHA');
  });
});
