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
    provider,
    model,
    apiKey: clientApiKey,
    password,
    budgetThresholds,
    allowOverBudget = false,
    callModelMode,
    retryHint,
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

  if (!profile || !Array.isArray(papers) || !provider || !model) {
    res.status(400).json({
      error: 'missing required fields: profile, papers[], provider, model',
    });
    return;
  }
  if (!apiKey) {
    res.status(401).json({ error: 'missing credentials: supply apiKey or password' });
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
    // Build the full rendered prompt (template + profile + papers).
    // cachePrefix = template-with-profile (stable for a given profile),
    // variableTail = papers JSON block (changes every run).
    const fullPrompt = renderSynthesisPrompt(template, { profile, papers });
    // The split point is just before the papers JSON block: find the last
    // occurrence of the papers marker in the rendered output by locating the
    // boundary between the profile portion and the papers portion. We do this
    // by rendering a version with an empty papers array to find the prefix length.
    const prefixOnly = renderSynthesisPrompt(template, { profile, papers: [] });
    // papers-section boundary = length of prefix-only up to the empty JSON "[]"
    // We split at the start of the papers JSON (the "[" from JSON.stringify).
    const splitIndex = prefixOnly.length - '[]'.length;
    const cachePrefix = fullPrompt.slice(0, splitIndex);

    // Phase 1.5.1: optional retry hint from the client-side hallucination
    // check + retry flow. Appended to the prompt so the model knows this is
    // a second attempt and needs to ground claims more carefully.
    const variableTail = retryHint
      ? `${fullPrompt.slice(splitIndex)}\n\n# Retry hint from validator\n\n${retryHint}`
      : fullPrompt.slice(splitIndex);

    // APARTURE_TEST_PROMPT_OVERRIDE replaces the variable tail for fixture-based
    // tests. When active, disable caching so the fixture hash keys only on
    // {provider, model, prompt, apiKey} — a predictable, stable value.
    const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
    const finalPrompt = promptOverride ?? cachePrefix + variableTail;
    const useCaching = provider === 'anthropic' && !promptOverride;

    // Token budget pre-flight (estimate against the full prompt string)
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
        prompt: useCaching ? variableTail : finalPrompt,
        apiKey,
        structuredOutput: {
          name: 'briefing',
          description: 'Aparture daily research briefing',
          schema: toJsonSchema(),
        },
        ...(useCaching ? { cachePrefix, cacheable: true } : {}),
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
    res.status(500).json({ error: 'synthesis failed', details: String(err?.message ?? err) });
  }
}
