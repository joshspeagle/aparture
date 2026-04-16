import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import handler from '../../pages/api/check-briefing.js';
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

// Mirrors checkBriefingJsonSchema() in pages/api/check-briefing.js — must stay in sync
// because the fixture hash depends on this schema being byte-for-byte identical.
function checkBriefingJsonSchema() {
  return {
    type: 'object',
    required: ['verdict', 'justification', 'flaggedClaims'],
    properties: {
      verdict: { type: 'string', enum: ['YES', 'MAYBE', 'NO'] },
      justification: { type: 'string' },
      flaggedClaims: {
        type: 'array',
        items: {
          type: 'object',
          required: ['excerpt', 'paperArxivId', 'concern'],
          properties: {
            excerpt: { type: 'string' },
            paperArxivId: { type: 'string' },
            concern: { type: 'string' },
          },
        },
      },
    },
  };
}

// Mirrors the renderBriefingText helper in pages/api/check-briefing.js — must stay in sync.
function renderBriefingText(briefing) {
  const parts = [];
  if (briefing?.executiveSummary) {
    parts.push(`EXECUTIVE SUMMARY:\n${briefing.executiveSummary}`);
  }
  if (Array.isArray(briefing?.themes) && briefing.themes.length > 0) {
    parts.push(
      `THEMES:\n${briefing.themes
        .map(
          (t, i) =>
            `  ${i + 1}. ${t.title ?? ''}\n     paperIds: [${(t.paperIds ?? []).join(', ')}]\n     argument: ${t.argument ?? ''}`
        )
        .join('\n')}`
    );
  }
  if (Array.isArray(briefing?.papers) && briefing.papers.length > 0) {
    parts.push(
      `PAPERS:\n${briefing.papers
        .map(
          (p) =>
            `  - ${p.arxivId} "${p.title ?? ''}"\n     onelinePitch: ${p.onelinePitch ?? ''}\n     whyMatters: ${p.whyMatters ?? ''}`
        )
        .join('\n')}`
    );
  }
  return parts.join('\n\n');
}

// Mirrors renderPapersCorpus in the route.
function renderPapersCorpus(papers) {
  if (!Array.isArray(papers) || papers.length === 0) return '(no papers)';
  return papers
    .map((p) => {
      const lines = [`- ${p.arxivId} "${p.title ?? ''}"`];
      if (p.abstract) lines.push(`  Abstract: ${p.abstract}`);
      if (p.quickSummary) lines.push(`  Quick summary: ${p.quickSummary}`);
      if (p.fullReport) {
        const truncated =
          p.fullReport.length > 4000
            ? `${p.fullReport.slice(0, 4000)}\n[...truncated]`
            : p.fullReport;
        lines.push(`  Full report: ${truncated}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

const CLEAN_BRIEFING = {
  executiveSummary:
    'Two new circuit-level interpretability papers advance understanding of attention head composition in multi-step reasoning.',
  themes: [
    {
      title: 'Attention head circuits for reasoning',
      argument:
        'Both papers converge on attention head composition as the key mechanism underlying multi-step inference.',
      paperIds: ['2504.01234'],
    },
  ],
  papers: [
    {
      arxivId: '2504.01234',
      title: 'Circuit-level analysis of reasoning',
      onelinePitch: 'Attention head circuits compose to enable multi-step inference.',
      whyMatters:
        'Directly grounded in the user profile focus on mechanistic interpretability of language models.',
    },
  ],
};

const CLEAN_PAPERS = [
  {
    arxivId: '2504.01234',
    title: 'Circuit-level analysis of reasoning',
    abstract:
      'We identify attention head circuits that compose to enable multi-step reasoning in transformer language models.',
    quickSummary: 'Identifies attention head circuits responsible for multi-step reasoning.',
    fullReport:
      'Full paper analysis: This paper identifies specific attention head circuits in transformer models that are responsible for multi-step reasoning tasks. The methodology uses causal patching to isolate circuits.',
  },
];

const HALLUCINATED_BRIEFING = {
  executiveSummary:
    'Smith et al. report a 94.3% accuracy gain on the MATH benchmark using a novel 12-layer mixture-of-experts architecture.',
  themes: [
    {
      title: 'Mixture-of-experts for mathematical reasoning',
      argument: 'The authors use a novel MoE architecture with 12 layers.',
      paperIds: ['2504.01234'],
    },
  ],
  papers: [
    {
      arxivId: '2504.01234',
      title: 'Circuit-level analysis of reasoning',
      onelinePitch: '94.3% accuracy on MATH via 12-layer MoE.',
      whyMatters: 'Sets a new state of the art on mathematical benchmarks.',
    },
  ],
};

async function seedFixture({ briefing, papers, response }) {
  const templatePath = path.resolve(process.cwd(), 'prompts', 'check-briefing.md');
  const template = await fs.readFile(templatePath, 'utf8');
  const prompt = template
    .replace('{{briefing}}', renderBriefingText(briefing))
    .replace('{{papers}}', renderPapersCorpus(papers));

  const input = {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    prompt,
    apiKey: 'test-key',
    structuredOutput: {
      name: 'briefing_hallucination_check',
      description: 'Aparture briefing hallucination audit result',
      schema: checkBriefingJsonSchema(),
    },
  };
  const hash = hashInput(input);
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(
    path.join(fixturesDir, `${hash}.json`),
    JSON.stringify({ hash, input, response }, null, 2)
  );
  return hash;
}

describe('check-briefing API route (fixture mode)', () => {
  beforeAll(async () => {
    await seedFixture({
      briefing: CLEAN_BRIEFING,
      papers: CLEAN_PAPERS,
      response: {
        text: '',
        tokensIn: 420,
        tokensOut: 50,
        structured: {
          verdict: 'NO',
          justification:
            'Every claim in the briefing about paper 2504.01234 is grounded in the provided abstract, quickSummary, and fullReport. No fabricated findings or unsupported paraphrases were detected.',
          flaggedClaims: [],
        },
      },
    });

    await seedFixture({
      briefing: HALLUCINATED_BRIEFING,
      papers: CLEAN_PAPERS,
      response: {
        text: '',
        tokensIn: 430,
        tokensOut: 120,
        structured: {
          verdict: 'YES',
          justification:
            'Multiple fabricated claims: the "94.3% accuracy gain on MATH" number does not appear in the source material, and the source paper is about circuit-level attention head analysis, not a mixture-of-experts architecture.',
          flaggedClaims: [
            {
              excerpt: '94.3% accuracy gain on the MATH benchmark',
              paperArxivId: '2504.01234',
              concern: 'No such number or benchmark mentioned in the source material.',
            },
            {
              excerpt: 'novel 12-layer mixture-of-experts architecture',
              paperArxivId: '2504.01234',
              concern: 'Source paper is about attention head circuits, not MoE architectures.',
            },
          ],
        },
      },
    });
  });

  it('returns verdict NO when the briefing is grounded in the source material', async () => {
    const { req, res, getResponse } = createMockReqRes({
      briefing: CLEAN_BRIEFING,
      papers: CLEAN_PAPERS,
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody.verdict).toBe('NO');
    expect(jsonBody.flaggedClaims).toEqual([]);
    expect(jsonBody.repaired).toBe(false);
  });

  it('returns verdict YES with flagged claims when the briefing invents findings', async () => {
    const { req, res, getResponse } = createMockReqRes({
      briefing: HALLUCINATED_BRIEFING,
      papers: CLEAN_PAPERS,
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(200);
    expect(jsonBody.verdict).toBe('YES');
    expect(jsonBody.flaggedClaims.length).toBeGreaterThan(0);
    expect(jsonBody.flaggedClaims[0].excerpt).toMatch(/94\.3%|mixture-of-experts/);
    expect(jsonBody.flaggedClaims[0].paperArxivId).toBe('2504.01234');
    expect(jsonBody.flaggedClaims[0].concern).toBeTruthy();
    expect(jsonBody.repaired).toBe(false);
  });

  it('rejects requests with neither apiKey nor password', async () => {
    const { req, res, getResponse } = createMockReqRes({
      briefing: CLEAN_BRIEFING,
      papers: CLEAN_PAPERS,
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(401);
    expect(jsonBody.error).toMatch(/apiKey|password/);
  });

  it('rejects requests missing required fields', async () => {
    const { req, res, getResponse } = createMockReqRes({
      // missing briefing
      papers: CLEAN_PAPERS,
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      apiKey: 'test-key',
      callModelMode: { mode: 'fixture', fixturesDir },
    });

    await handler(req, res);
    const { statusCode, jsonBody } = getResponse();

    expect(statusCode).toBe(400);
    expect(jsonBody.error).toMatch(/missing required fields/);
  });
});
