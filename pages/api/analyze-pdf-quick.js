import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { sendProviderErrorResponse } from '../../lib/llm/ProviderError.js';
import { checkRoutePassword, resolveRouteAuth } from '../../lib/llm/resolveRouteAuth.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const {
    paper,
    fullReport,
    provider,
    model,
    apiKey: clientApiKey,
    password,
    callModelMode,
  } = req.body ?? {};

  // Phase 1: password gate before the body-field 400 so a wrong password is
  // always a 401, matching this route's original check ordering.
  const gate = checkRoutePassword({ apiKey: clientApiKey, password });
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  if (!paper?.arxivId || !fullReport || !provider || !model) {
    res.status(400).json({
      error: 'missing required fields: paper.arxivId, fullReport, provider, model',
    });
    return;
  }

  // Phase 2: env-key resolution + callMode + fixture-aware credential check
  // (fixture mode skips the missing-credentials 401; see resolveRouteAuth).
  const auth = resolveRouteAuth({ apiKey: clientApiKey, password, provider, callModelMode });
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const { apiKey, callMode } = auth;

  try {
    const templatePath = path.resolve(process.cwd(), 'prompts', 'analyze-pdf-quick.md');
    const template = await fs.readFile(templatePath, 'utf8');

    const fullPrompt = template
      .replaceAll('{{title}}', () => paper.title ?? '')
      .replaceAll('{{authors}}', () => (paper.authors ?? []).join(', '))
      .replaceAll('{{arxivId}}', () => paper.arxivId)
      .replaceAll('{{fullReport}}', () => fullReport)
      .replaceAll('{{abstract}}', () => paper.abstract ?? '')
      .replaceAll('{{scoringJustification}}', () => paper.scoringJustification ?? '');

    // The stable cache prefix is the template text before the first per-paper
    // placeholder ({{title}}). The variable tail is the rendered paper content.
    const firstSlotIdx = template.indexOf('{{title}}');
    const cachePrefix = firstSlotIdx >= 0 ? template.slice(0, firstSlotIdx) : '';

    // Resolve user-facing model ID → apiId via MODEL_REGISTRY; fall through
    // unchanged if the caller already passed an apiId or an unknown value.
    const modelApiId = MODEL_REGISTRY[model]?.apiId ?? model;

    // Disable caching in fixture mode so the fixture hash stays keyed on the
    // full rendered prompt only — the same shape the test's beforeAll seeded.
    // Also disable when APARTURE_TEST_PROMPT_OVERRIDE is set: that env flag
    // forces a deterministic prompt for fixture lookups regardless of mode.
    const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
    const isFixture = callMode.mode === 'fixture';
    const useCaching = provider === 'anthropic' && !isFixture && !promptOverride;

    const response = await callModel(
      {
        provider,
        model: modelApiId,
        prompt: useCaching ? fullPrompt.slice(cachePrefix.length) : fullPrompt,
        apiKey,
        ...(useCaching ? { cachePrefix, cacheable: true } : {}),
      },
      callMode
    );

    res.status(200).json({
      arxivId: paper.arxivId,
      quickSummary: response.text.trim(),
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      // Anthropic reports cache reads separately from input tokens; surfaced
      // so client-side cost tracking can price them (0 when absent).
      cacheReadTok: response.cacheReadTok ?? 0,
    });
  } catch (err) {
    if (sendProviderErrorResponse(res, err)) return;
    res.status(500).json({ error: 'quick summary failed', details: String(err?.message ?? err) });
  }
}
