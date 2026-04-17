import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import handler from '../../pages/api/analyze-pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures/llm');

// Read the real minimal PDF fixture and base64-encode it for the _testPdfBase64 escape hatch.
// The APARTURE_TEST_PDF_OVERRIDE env var replaces the actual bytes with a constant placeholder
// before callModel hashes the input, ensuring a stable fixture hash.
const minimalPdfPath = path.resolve(__dirname, '../fixtures/pdf/minimal.pdf');
const MINIMAL_PDF_B64 = fs.readFileSync(minimalPdfPath).toString('base64');

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

beforeAll(() => {
  process.env.ACCESS_PASSWORD = 'test-pw';
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;
  delete process.env.APARTURE_TEST_PDF_OVERRIDE;
});

describe('analyze-pdf API route (fixture mode)', () => {
  it('returns analysis shape for the PDF path', async () => {
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = 'ANALYZE_PDF_TEST_FIXTURE';
    process.env.APARTURE_TEST_PDF_OVERRIDE = 'ANALYZE_PDF_TEST_PDF_FIXTURE';
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      pdfUrl: 'https://arxiv.org/pdf/2504.00001',
      scoringCriteria: 'I study interpretability.',
      originalScore: 7.5,
      model: 'claude-haiku-4.5',
      _testPdfBase64: MINIMAL_PDF_B64,
      callModelMode: { mode: 'fixture', fixturesDir },
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody).toHaveProperty('analysis');
    expect(jsonBody.analysis).toMatchObject({
      updatedScore: expect.any(Number),
      summary: expect.any(String),
      keyFindings: expect.any(String),
      methodology: expect.any(String),
      limitations: expect.any(String),
      relevanceAssessment: expect.any(String),
    });
    expect(jsonBody.analysis.updatedScore).toBeGreaterThanOrEqual(0);
    expect(jsonBody.analysis.updatedScore).toBeLessThanOrEqual(10);
    expect(typeof jsonBody.rawResponse).toBe('string');
  });

  it('returns analysis shape for the correction path', async () => {
    // The explicit correctionPrompt branch passes the prompt through directly —
    // no APARTURE_TEST_PROMPT_OVERRIDE substitution in this route branch.
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      model: 'claude-haiku-4.5',
      correctionPrompt: 'Fix this JSON response.',
      callModelMode: { mode: 'fixture', fixturesDir },
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(jsonBody).toHaveProperty('analysis');
    expect(jsonBody.analysis).toMatchObject({
      updatedScore: expect.any(Number),
      summary: expect.any(String),
      keyFindings: expect.any(String),
    });
    expect(jsonBody.analysis.updatedScore).toBeGreaterThanOrEqual(0);
  });

  it('rejects invalid password', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      model: 'claude-haiku-4.5',
      pdfUrl: 'https://arxiv.org/pdf/2504.00001',
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects non-POST requests', async () => {
    const req = { method: 'GET', body: {} };
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
    await handler(req, res);
    expect(state.statusCode).toBe(405);
  });

  it('rejects unsupported model with 400', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      model: 'not-a-real-model',
      pdfUrl: 'https://arxiv.org/pdf/2504.00001',
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(400);
  });
});
