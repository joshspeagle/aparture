import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { resolveApiKey } from '../../lib/llm/resolveApiKey.js';
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

  if (!profile || !Array.isArray(papers) || !provider || !model) {
    res.status(400).json({
      error: 'missing required fields: profile, papers[], provider, model',
    });
    return;
  }

  // Resolve API key via the shared helper (validates password, picks env key
  // by provider). This matches the pattern used by the other briefing routes
  // (check-briefing, suggest-profile, analyze-pdf).
  const resolved = resolveApiKey({ clientApiKey, password, provider });
  if (resolved.error) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const apiKey = resolved.apiKey;
  // Skip the auth check in fixture mode — fixture-based tests don't need a
  // real key because callModel never actually hits the network.
  if (!apiKey && (callModelMode?.mode ?? 'live') !== 'fixture') {
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
    // cachePrefix = template-prefix-with-profile (stable for a given profile),
    // variableTail = papers JSON block + any template content after {{papers}}
    // (changes every run).
    const fullPrompt = renderSynthesisPrompt(template, { profile, papers });
    // Split at the {{papers}} slot in the raw template: everything before is
    // the cacheable prefix (template instructions + the profile substitution);
    // everything after is the variable tail. This is robust to template changes
    // as long as the template still has a {{papers}} slot. The invariant
    // `cachePrefix + variableTail === fullPrompt` holds byte-for-byte.
    const papersSlotPos = template.indexOf('{{papers}}');
    const templatePrefix = template.slice(0, papersSlotPos);
    const cachePrefix = templatePrefix.replaceAll('{{profile}}', profile ?? '');
    const splitIndex = cachePrefix.length;

    // Phase 1.5.1: optional retry hint from the client-side hallucination
    // check + retry flow. Appended to the prompt so the model knows this is
    // a second attempt and needs to ground claims more carefully.
    const variableTail = retryHint
      ? `${fullPrompt.slice(splitIndex)}\n\n# Retry hint from validator\n\n${retryHint}`
      : fullPrompt.slice(splitIndex);

    // APARTURE_TEST_PROMPT_OVERRIDE replaces the variable tail for fixture-based
    // tests. When active (or when running in fixture mode), disable caching so
    // the fixture hash keys only on {provider, model, prompt, apiKey} — a
    // predictable, stable value.
    const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
    const callMode = callModelMode ?? { mode: 'live' };
    const isFixture = callMode.mode === 'fixture';
    const finalPrompt = promptOverride ?? cachePrefix + variableTail;
    const useCaching = provider === 'anthropic' && !isFixture && !promptOverride;

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
