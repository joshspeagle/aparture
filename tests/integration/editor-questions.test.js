import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import handler from '../../pages/api/editor-questions.js';
import { hashInput } from '../../lib/llm/hash.js';
import { editorQuestionsJsonSchema } from '../../lib/editorQuestions/questions.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

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

const PROMPT = 'EDITOR_QUESTIONS_FIXTURE';
const MODEL = 'claude-sonnet-5.5';
const papers = [{ arxivId: '2610.00001', title: 'Paper one', score: 7.8, pitch: 'Does X.' }];
const nearMisses = [{ arxivId: '2610.00002', title: 'Paper two', score: 7.1 }];

describe('/api/editor-questions (fixture mode)', () => {
  let tmpDir;

  const seed = async (structured) => {
    const hash = hashInput({
      provider: 'anthropic',
      // The route sends the registry apiId, so the fixture is keyed on it.
      model: MODEL_REGISTRY[MODEL].apiId,
      prompt: PROMPT,
      apiKey: 'test-key',
      structuredOutput: {
        name: 'editor_questions',
        description: "Aparture editor's questions for the reader",
        schema: editorQuestionsJsonSchema(),
      },
    });
    await fs.writeFile(
      path.join(tmpDir, `${hash}.json`),
      JSON.stringify({ response: { text: '', structured, tokensIn: 50, tokensOut: 20 } }),
      'utf8'
    );
  };

  const run = async (body = {}) => {
    const { req, res, getResponse } = createMockReqRes({
      profile: 'I study stellar streams.',
      papers,
      nearMisses,
      provider: 'anthropic',
      model: MODEL,
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir: tmpDir },
      ...body,
    });
    process.env.APARTURE_TEST_PROMPT_OVERRIDE = PROMPT;
    try {
      await handler(req, res);
    } finally {
      delete process.env.APARTURE_TEST_PROMPT_OVERRIDE;
    }
    return getResponse();
  };

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aparture-editor-q-'));
  });

  afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns validated questions and reports what it dropped', async () => {
    await seed({
      questions: [
        {
          id: 'a',
          text: 'Paper two scored 7.1 in an area your profile never names. Want more like it?',
          options: ['Yes', 'No'],
          evidence: ['2610.00002'],
        },
        {
          id: 'b',
          text: 'Is this about a paper you never saw?',
          options: ['Yes', 'No'],
          evidence: ['2610.12345'],
        },
      ],
    });
    const { statusCode, jsonBody } = await run();
    expect(statusCode).toBe(200);
    expect(jsonBody.questions).toEqual([
      {
        id: 'q1',
        text: 'Paper two scored 7.1 in an area your profile never names. Want more like it?',
        options: ['Yes', 'No'],
        evidence: ['2610.00002'],
      },
    ]);
    expect(jsonBody.dropped).toHaveLength(1);
  });

  it('rejects a request without papers', async () => {
    const { statusCode } = await run({ papers: undefined });
    expect(statusCode).toBe(400);
  });

  it('rejects a wrong password before doing anything', async () => {
    process.env.ACCESS_PASSWORD = 'right';
    try {
      const { statusCode } = await run({ apiKey: undefined, password: 'wrong' });
      expect(statusCode).toBe(401);
    } finally {
      delete process.env.ACCESS_PASSWORD;
    }
  });
});
