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
      // Key-shaped (the route rejects implausible keys before downloading);
      // never reaches a provider — every case here fails at the download.
      apiKey: 'sk-ant-api03-test-key-not-real-0000000000',
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
    vi.doUnmock('../../../lib/arxiv/spacing.js');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // Auth before any download (audit P2-9): any non-empty apiKey used to skip
  // the password gate, so a LAN client with apiKey "x" could make this route
  // download arXiv PDFs and launch headless Chromium before the provider ever
  // rejected the key.
  test.each([
    ['an implausible apiKey', { apiKey: 'x' }, /not a valid anthropic key/],
    [
      'a key shaped for another provider',
      { apiKey: 'AIzaSyDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY12' },
      /not a valid anthropic key/,
    ],
    ['a wrong password', { apiKey: undefined, password: 'wrong' }, /invalid password/],
    ['no credentials at all', { apiKey: undefined }, /missing credentials/],
  ])('rejects %s with 401 before touching arXiv', async (_label, creds, message) => {
    global.fetch = vi.fn(async () => {
      throw new Error('must not download');
    });
    const { default: handler } = await import('../../../pages/api/analyze-pdf.js');
    const { req, res } = makeReqRes();
    Object.assign(req.body, creds);
    await handler(req, res);

    expect(res.getStatus()).toBe(401);
    expect(res.getJson().error).toMatch(message);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('the valid password still authenticates without a client key', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    const prevKey = process.env.CLAUDE_API_KEY;
    process.env.CLAUDE_API_KEY = 'sk-ant-api03-env-key-not-real-000000000000';
    try {
      const { default: handler } = await import('../../../pages/api/analyze-pdf.js');
      const { req, res } = makeReqRes();
      req.body.apiKey = undefined;
      req.body.password = 'test-password';
      await handler(req, res);
      // Past the auth gate: the download ran (and 404'd).
      expect(global.fetch).toHaveBeenCalled();
      expect(res.getStatus()).toBe(404);
    } finally {
      if (prevKey === undefined) delete process.env.CLAUDE_API_KEY;
      else process.env.CLAUDE_API_KEY = prevKey;
    }
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
      // The retry takes a second throttle slot; shrink the 15 s production
      // spacing (robots.txt Crawl-delay) so the test doesn't wait it out.
      vi.doMock('../../../lib/arxiv/spacing.js', async (importOriginal) => ({
        ...(await importOriginal()),
        ARXIV_PAGE_DELAY_MS: 20,
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
