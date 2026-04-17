import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../../pages/api/synthesize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: mock Next.js req/res
function createMockReqRes(body) {
  const req = { method: 'POST', body };
  let statusCode;
  let jsonBody;
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
  return { req, res, getResponse: () => ({ statusCode, jsonBody }) };
}

const fixturesDir = path.resolve(__dirname, '../fixtures/llm');

describe('synthesize API route — auth + method guards', () => {
  it('rejects missing/wrong password with 401', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      profile: 'I study interpretability.',
      papers: [],
      provider: 'anthropic',
      model: 'claude-opus-4-6',
    });
    await handler(req, res);
    expect(getResponse().statusCode).toBe(401);
  });

  it('rejects non-POST methods with 405', async () => {
    const { req, res, getResponse } = createMockReqRes({});
    req.method = 'GET';
    await handler(req, res);
    expect(getResponse().statusCode).toBe(405);
  });
});

describe('synthesize API route (fixture mode)', () => {
  it('returns a validated briefing when the fixture is good', async () => {
    const { req, res, getResponse } = createMockReqRes({
      profile: 'I study mechanistic interpretability of large language models.',
      papers: [
        { arxivId: '2504.01234', title: 'Circuit-level analysis of reasoning', abstract: '...' },
        { arxivId: '2504.02345', title: 'Head pruning ablations', abstract: '...' },
      ],
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });
    // Override the synthesis prompt to the known fixture key
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = 'SYNTHESIS_PROMPT_FIXTURE';

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    // Cleanup env var
    delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;

    expect(statusCode).toBe(200);
    expect(jsonBody.briefing.executiveSummary).toContain('interpretability');
    expect(jsonBody.briefing.papers).toHaveLength(2);
    expect(jsonBody.repaired).toBe(false);
  });
});
