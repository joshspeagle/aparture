import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { renderSynthesisPrompt } from '../../lib/synthesis/renderPrompt.js';
import { toJsonSchema } from '../../lib/synthesis/schema.js';
import { validateBriefing } from '../../lib/synthesis/validator.js';
import { repairBriefing } from '../../lib/synthesis/repair.js';
import { estimateTokens, budgetPreflight } from '../../lib/llm/tokenBudget.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const {
    profile,
    papers,
    history,
    provider,
    model,
    apiKey,
    budgetThresholds,
    allowOverBudget = false,
    callModelMode,
  } = req.body ?? {};

  if (!profile || !Array.isArray(papers) || !provider || !model || !apiKey) {
    res.status(400).json({
      error: 'missing required fields: profile, papers[], provider, model, apiKey',
    });
    return;
  }

  try {
    // Load the synthesis prompt template
    const templatePath = path.resolve(process.cwd(), 'prompts', 'synthesis.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const prompt = renderSynthesisPrompt(template, {
      profile,
      papers,
      history: history ?? [],
    });
    const finalPrompt = process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? prompt;

    // Token budget pre-flight
    const estimatedTokens = estimateTokens({ provider, model, text: finalPrompt });
    const preflight = budgetPreflight({ estimatedTokens, thresholds: budgetThresholds });
    if (preflight.action === 'block' && !allowOverBudget) {
      res.status(400).json({
        error: 'synthesis prompt exceeds token budget',
        estimatedTokens,
        action: 'block',
      });
      return;
    }

    const inputPaperIds = papers.map((p) => p.arxivId);

    const callMode = callModelMode ?? { mode: 'live' };

    // First call
    const response = await callModel(
      {
        provider,
        model,
        prompt: finalPrompt,
        apiKey,
        structuredOutput: {
          name: 'briefing',
          description: 'Aparture daily research briefing',
          schema: toJsonSchema(),
        },
      },
      callMode
    );

    if (!response.structured) {
      res.status(502).json({
        error: 'model did not return structured output',
        text: response.text,
      });
      return;
    }

    // Validate
    const validation = validateBriefing(response.structured, inputPaperIds);
    if (validation.ok) {
      res.status(200).json({
        briefing: response.structured,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        repaired: false,
        preflight,
      });
      return;
    }

    // Repair
    const { briefing, repaired } = await repairBriefing({
      briefing: response.structured,
      inputPaperIds,
      callModel: (input) => callModel(input, callMode),
      llmConfig: { provider, model, apiKey },
    });

    res.status(200).json({
      briefing,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      repaired,
      preflight,
      originalValidationErrors: validation.errors,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
