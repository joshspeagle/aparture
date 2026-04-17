import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import handler from '../../pages/api/analyze-pdf-quick.js';
import { hashInput } from '../../lib/llm/hash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const fixturesDir = path.resolve(__dirname, '../fixtures/llm/runtime');

describe('analyze-pdf-quick API route — auth + method guards', () => {
  it('rejects missing/wrong password with 401', async () => {
    const { req, res, getResponse } = createMockReqRes({
      password: 'wrong',
      paper: { arxivId: '2504.99999', title: 'Test' },
      fullReport: 'report text',
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
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

describe('analyze-pdf-quick API route (fixture mode)', () => {
  beforeAll(async () => {
    // Build the prompt the handler will generate, hash it, and seed a fixture.
    const templatePath = path.resolve(process.cwd(), 'prompts', 'analyze-pdf-quick.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const prompt = template
      .replaceAll('{{title}}', 'Test Paper')
      .replaceAll('{{authors}}', 'A. Author')
      .replaceAll('{{arxivId}}', '2504.99999')
      .replaceAll('{{fullReport}}', 'Full report content goes here.')
      .replaceAll('{{abstract}}', 'Test abstract.')
      .replaceAll('{{scoringJustification}}', 'Scores well on alignment with the user.');

    const input = {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      prompt,
      apiKey: 'test-key',
    };
    const hash = hashInput(input);
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.writeFile(
      path.join(fixturesDir, `${hash}.json`),
      JSON.stringify(
        {
          hash,
          input,
          response: {
            text: 'This is a ~300 word compression of the full report. It explains the paper in plain prose.',
            tokensIn: 500,
            tokensOut: 80,
          },
        },
        null,
        2
      )
    );
  });

  it('returns a quick summary from a full report', async () => {
    const { req, res, getResponse } = createMockReqRes({
      paper: {
        arxivId: '2504.99999',
        title: 'Test Paper',
        authors: ['A. Author'],
        abstract: 'Test abstract.',
        scoringJustification: 'Scores well on alignment with the user.',
      },
      fullReport: 'Full report content goes here.',
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody.arxivId).toBe('2504.99999');
    expect(jsonBody.quickSummary).toContain('compression of the full report');
  });
});
