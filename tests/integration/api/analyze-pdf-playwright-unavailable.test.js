// Verifies that when Playwright is unavailable and reCAPTCHA is detected
// during PDF download, the analyze-pdf API returns HTTP 422 with the
// PLAYWRIGHT_UNAVAILABLE_RECAPTCHA error code + paper metadata.
//
// Uses vi.doMock to make the dynamic `import('playwright')` reject,
// simulating the package not being installed.

import { describe, test, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

describe('analyze-pdf — Playwright unavailable', () => {
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
    // and the handler exercises the real download + reCAPTCHA detection path.
    process.env.NODE_ENV = 'development';

    // Mock fetch to return a non-PDF response body (simulates reCAPTCHA HTML)
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from('<html>CAPTCHA page</html>', 'utf-8').buffer,
    }));

    // Make the dynamic Playwright import throw — simulating the package
    // being uninstalled. Vitest's vi.doMock applies to dynamic imports
    // when combined with vi.resetModules() above.
    vi.doMock('playwright', () => {
      throw new Error("Cannot find module 'playwright'");
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    vi.doUnmock('playwright');
    vi.resetModules();
  });

  test('returns PLAYWRIGHT_UNAVAILABLE_RECAPTCHA when Playwright missing and reCAPTCHA detected', async () => {
    const { default: handler } = await import('../../../pages/api/analyze-pdf.js');

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
        // Supply an apiKey directly so auth passes without needing the
        // provider env key to be set in the test runner's environment.
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
    };

    await handler(req, res);

    expect(statusCode).toBe(422);
    expect(jsonBody).toEqual(
      expect.objectContaining({
        error: 'PLAYWRIGHT_UNAVAILABLE_RECAPTCHA',
        arxivId: '2501.12345',
        title: 'Test paper',
      })
    );
  });
});
