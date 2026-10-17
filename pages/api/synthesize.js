import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { resolveRouteAuth } from '../../lib/llm/resolveRouteAuth.js';
import { sendProviderErrorResponse } from '../../lib/llm/ProviderError.js';
import { sendRefusalErrorResponse } from '../../lib/llm/RefusalError.js';
import { renderSynthesisPrompt } from '../../lib/synthesis/renderPrompt.js';
import { renderReaderNotesSection } from '../../lib/synthesis/readerNotes.js';
import { BriefingSchema, toJsonSchema } from '../../lib/synthesis/schema.js';
import {
  normalizeBriefing,
  salvageBriefing,
  validateBriefing,
} from '../../lib/synthesis/validator.js';
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
    readerNotes,
  } = req.body ?? {};

  if (!profile || !Array.isArray(papers) || !provider || !model) {
    res.status(400).json({
      error: 'missing required fields: profile, papers[], provider, model',
    });
    return;
  }

  // Shared route auth: validates the password, picks the env key by
  // provider, resolves callMode, and skips the missing-credentials 401 in
  // fixture mode (see lib/llm/resolveRouteAuth.js). This matches the pattern
  // used by the other briefing routes (check-briefing, suggest-profile,
  // analyze-pdf).
  const auth = resolveRouteAuth({ apiKey: clientApiKey, password, provider, callModelMode });
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const { apiKey, callMode } = auth;

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
    // Function replacement: a string value would get GetSubstitution semantics
    // ($$, $&, $`, $') and corrupt LaTeX-bearing profiles — matching
    // lib/synthesis/renderPrompt.js.
    const cachePrefix = templatePrefix.replaceAll('{{profile}}', () => profile ?? '');

    // Phase 1.5.1: optional retry hint from the client-side hallucination
    // check + retry flow. Appended to the prompt so the model knows this is
    // a second attempt and needs to ground claims more carefully.
    const hintSuffix = retryHint ? `\n\n# Retry hint from validator\n\n${retryHint}` : '';
    // The reader's pre-briefing notes ("Lead with …"), if any. Appended after
    // the rendered prompt like the retry hint, so cachePrefix is unchanged.
    const notesSuffix = renderReaderNotesSection(readerNotes);

    // APARTURE_TEST_PROMPT_OVERRIDE replaces the variable tail for fixture-based
    // tests. When active (or when running in fixture mode), disable caching so
    // the fixture hash keys only on {provider, model, prompt, apiKey} — a
    // predictable, stable value.
    const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
    const isFixture = callMode.mode === 'fixture';
    const finalPrompt = promptOverride ?? fullPrompt + notesSuffix + hintSuffix;
    // Defensive prefix check (mirrors suggest-profile): the computed
    // cachePrefix must be a byte-for-byte prefix of the full rendered prompt,
    // or the cache split would corrupt the prompt. On mismatch, fall back to
    // sending the intact full prompt uncached rather than erroring.
    const useCaching =
      provider === 'anthropic' &&
      !isFixture &&
      !promptOverride &&
      fullPrompt.startsWith(cachePrefix);
    const variableTail = useCaching
      ? fullPrompt.slice(cachePrefix.length) + notesSuffix + hintSuffix
      : finalPrompt;

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

    // Deterministic corrections first: each card's title and score come from
    // the input paper (the model only copies them), duplicates are dropped.
    // Reported in `corrections`, never failed. See lib/synthesis/validator.js.
    const normalized = normalizeBriefing(response.structured, papers);
    const validation = validateBriefing(normalized.briefing, papers);
    if (validation.ok) {
      res.status(200).json({
        briefing: normalized.briefing,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        repaired: false,
        corrections: normalized.corrections,
        preflight,
      });
      return;
    }

    // LLM repair (one shot), then — if that fails — deterministic salvage.
    try {
      const repair = await repairBriefing({
        briefing: normalized.briefing,
        inputPapers: papers,
        callModel: (input) => callModel(input, callMode),
        llmConfig: { provider, model: modelApiId, apiKey },
      });
      res.status(200).json({
        briefing: repair.briefing,
        tokensIn: response.tokensIn + (repair.tokensIn ?? 0),
        tokensOut: response.tokensOut + (repair.tokensOut ?? 0),
        repaired: repair.repaired,
        corrections: [...normalized.corrections, ...(repair.corrections ?? [])],
        preflight,
        originalValidationErrors: validation.errors,
      });
      return;
    } catch (repairErr) {
      // A provider rate limit, refusal or 5xx during repair, a text-only
      // repair, or a repair that still fails validation: rather than throw
      // away the briefing after all the per-paper spend, salvage the best
      // schema-valid candidate — strip unknown ids, give every left-out
      // paper a labelled card, group unthemed cards — and say so.
      const candidate = [repairErr?.briefing, normalized.briefing].find(
        (b) => b && BriefingSchema.safeParse(b).success
      );
      if (!candidate) throw repairErr;
      const salvage = salvageBriefing(candidate, papers);
      const finalCheck = validateBriefing(salvage.briefing, papers);
      if (!finalCheck.ok) throw repairErr;
      console.warn(
        `[synthesize] repair failed (${repairErr?.message ?? repairErr}); salvaged deterministically:`,
        salvage.actions
      );
      res.status(200).json({
        briefing: salvage.briefing,
        tokensIn: response.tokensIn + (repairErr?.tokensIn ?? 0),
        tokensOut: response.tokensOut + (repairErr?.tokensOut ?? 0),
        // true when the salvaged candidate is the LLM-repaired briefing,
        // false when repair produced nothing usable and the first pass was used.
        repaired: candidate === repairErr?.briefing,
        corrections: [...normalized.corrections, ...(repairErr?.corrections ?? [])],
        salvaged: salvage.actions,
        repairError: String(repairErr?.message ?? repairErr),
        preflight,
        originalValidationErrors: validation.errors,
      });
      return;
    }
  } catch (err) {
    if (sendRefusalErrorResponse(res, err)) return;
    if (sendProviderErrorResponse(res, err)) return;
    res.status(500).json({ error: 'synthesis failed', details: String(err?.message ?? err) });
  }
}
