import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { renderSynthesisPrompt } from '../../lib/synthesis/renderPrompt.js';
import { toJsonSchema } from '../../lib/synthesis/schema.js';
import { validateBriefing } from '../../lib/synthesis/validator.js';
import { repairBriefing } from '../../lib/synthesis/repair.js';
import { estimateTokens, budgetPreflight } from '../../lib/llm/tokenBudget.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

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
    apiKey: clientApiKey,
    password,
    budgetThresholds,
    allowOverBudget = false,
    callModelMode,
  } = req.body ?? {};

  // Resolve API key: accept client-supplied key, or fall back to env vars via password auth
  let apiKey = clientApiKey;
  if (!apiKey && password) {
    if (password !== process.env.ACCESS_PASSWORD) {
      res.status(401).json({ error: 'invalid password' });
      return;
    }
    // Pick the env key for the requested provider
    if (provider === 'anthropic') apiKey = process.env.CLAUDE_API_KEY;
    else if (provider === 'google') apiKey = process.env.GOOGLE_AI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
  }

  if (!profile || !Array.isArray(papers) || !provider || !model || !apiKey) {
    res.status(400).json({
      error:
        'missing required fields: profile, papers[], provider, model, and either apiKey or password',
    });
    return;
  }

  // Resolve user-facing model ID to the provider's apiId via MODEL_REGISTRY.
  // If the caller already passed an apiId, or the ID is unknown to the
  // registry, fall through unchanged so existing tests and BYOK flows that
  // pass raw apiIds keep working.
  const modelApiId = MODEL_REGISTRY[model]?.apiId ?? model;

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
    const estimatedTokens = estimateTokens({ provider, model: modelApiId, text: finalPrompt });
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
        model: modelApiId,
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
      llmConfig: { provider, model: modelApiId, apiKey },
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
