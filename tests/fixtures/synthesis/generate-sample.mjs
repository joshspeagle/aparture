import { hashInput } from '../../../lib/llm/hash.js';
import { toJsonSchema } from '../../../lib/synthesis/schema.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prompt = 'SYNTHESIS_PROMPT_FIXTURE'; // a known synthetic prompt
const input = {
  provider: 'anthropic',
  model: 'claude-opus-4-6',
  prompt,
  apiKey: 'test-key',
  structuredOutput: {
    name: 'briefing',
    description: 'Aparture daily research briefing',
    schema: toJsonSchema(),
  },
};
const hash = hashInput(input);

const briefing = {
  executiveSummary:
    'Today in ML, three threads pull on the same knot: interpretability methods are converging on attention-head-level analysis, a new debate is emerging about whether heads are the right unit at all, and two papers offer competing ablation strategies.',
  themes: [
    {
      title: 'Interpretability converges on attention heads',
      argument:
        'Both papers analyze circuits at the attention-head level, using different ablation strategies but reaching compatible conclusions about head specialization.',
      paperIds: ['2504.01234', '2504.02345'],
    },
  ],
  papers: [
    {
      arxivId: '2504.01234',
      title: 'Circuit-level analysis of reasoning',
      score: 9.2,
      onelinePitch:
        'A mechanistic account of how attention heads compose into multi-step reasoning circuits.',
      whyMatters:
        'Directly grounded in your stated interest in mechanistic interpretability of large language models.',
      figures: [],
      quickSummaryPath: 'reports/2026-04-13/papers/2504.01234-quick.md',
      fullReportPath: 'reports/2026-04-13/papers/2504.01234-full.md',
    },
    {
      arxivId: '2504.02345',
      title: 'Head pruning ablations',
      score: 8.5,
      onelinePitch:
        'Ablation evidence that only a small subset of attention heads matter for task-specific reasoning.',
      whyMatters: 'Tests the framing from your March 3 starred paper on circuit sparsity.',
      figures: [],
      quickSummaryPath: 'reports/2026-04-13/papers/2504.02345-quick.md',
      fullReportPath: 'reports/2026-04-13/papers/2504.02345-full.md',
    },
  ],
  debates: [],
  longitudinal: [],
  proactiveQuestions: [],
};

const fixturePath = path.resolve(__dirname, '../llm', `${hash}.json`);
await fs.mkdir(path.dirname(fixturePath), { recursive: true });
await fs.writeFile(
  fixturePath,
  JSON.stringify(
    {
      hash,
      input,
      response: { text: '', structured: briefing, tokensIn: 100, tokensOut: 200 },
    },
    null,
    2,
  ),
  'utf8',
);
console.log('wrote fixture:', fixturePath);
console.log('hash:', hash);
