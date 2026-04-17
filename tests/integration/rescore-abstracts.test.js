import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../../pages/api/rescore-abstracts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures/llm');

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
});

afterEach(() => {
  delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;
});

describe('rescore-abstracts API route (fixture mode)', () => {
  it('returns rescores for the provided papers', async () => {
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = 'RESCORE_ABSTRACTS_TEST_FIXTURE';
    const { req, res, getResponse } = createMockReqRes({
      password: 'test-pw',
      papers: [
        {
          title: 'Paper A',
          abstract: 'abs A',
          initialScore: 7.0,
          initialJustification: 'Good alignment with interests.',
        },
        {
          title: 'Paper B',
          abstract: 'abs B',
          initialScore: 5.5,
          initialJustification: 'Moderate alignment.',
        },
      ],
      scoringCriteria: 'I study interpretability.',
      model: 'claude-haiku-4.5',
      callModelMode: { mode: 'fixture', fixturesDir },
    });
    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();
    expect(statusCode).toBe(200);
    expect(Array.isArray(jsonBody.rescores)).toBe(true);
    expect(jsonBody.rescores).toHaveLength(2);
    expect(jsonBody.rescores[0]).toMatchObject({
      paperIndex: 1,
      adjustedScore: 7.5,
      confidence: 'HIGH',
    });
    expect(jsonBody.rescores[1]).toMatchObject({
      paperIndex: 2,
      adjustedScore: 5.0,
      confidence: 'MEDIUM',
    });
    expect(typeof jsonBody.rawResponse).toBe('string');
  });

  it('rejects invalid password', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      papers: [],
      model: 'claude-haiku-4.5',
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects non-POST methods', async () => {
    const { req, res, getResponse } = createMockReqRes({});
    req.method = 'GET';
    await handler(req, res);
    expect(getResponse().statusCode).toBe(405);
  });
});
