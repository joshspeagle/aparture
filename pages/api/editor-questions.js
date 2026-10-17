// Editor's questions for a finished briefing: at most two tap-to-answer
// questions when today's papers exposed an ambiguity in the profile. One
// small structured call on the briefing model; the client treats a failure
// as "no questions today" (lib/analyzer/briefingClient.js).
import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { sendProviderErrorResponse } from '../../lib/llm/ProviderError.js';
import { sendRefusalErrorResponse } from '../../lib/llm/RefusalError.js';
import { checkRoutePassword, resolveRouteAuth } from '../../lib/llm/resolveRouteAuth.js';
import {
  editorQuestionsJsonSchema,
  renderEditorQuestionsPrompt,
  validateEditorQuestions,
} from '../../lib/editorQuestions/questions.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const {
    profile,
    papers,
    nearMisses = [],
    feedbackEvents = [],
    provider,
    model,
    apiKey: clientApiKey,
    password,
    callModelMode,
  } = req.body ?? {};

  const gate = checkRoutePassword({ apiKey: clientApiKey, password });
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  if (typeof profile !== 'string' || !Array.isArray(papers) || !provider || !model) {
    res.status(400).json({ error: 'missing required fields: profile, papers, provider, model' });
    return;
  }

  const auth = resolveRouteAuth({ apiKey: clientApiKey, password, provider, callModelMode });
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const { apiKey, callMode } = auth;

  try {
    const templatePath = path.resolve(process.cwd(), 'prompts', 'editor-questions.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const fullPrompt = renderEditorQuestionsPrompt(template, {
      profile,
      papers,
      nearMisses,
      feedbackEvents,
    });

    // Stable prefix = the instructions before the first per-reader slot.
    const firstSlot = template.indexOf('{{profile}}');
    const cachePrefix = firstSlot >= 0 ? template.slice(0, firstSlot) : '';
    const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
    const isFixture = callMode.mode === 'fixture';
    const useCaching = provider === 'anthropic' && !isFixture && !promptOverride;
    const finalPrompt = promptOverride ?? fullPrompt;

    const response = await callModel(
      {
        provider,
        model: MODEL_REGISTRY[model]?.apiId ?? model,
        prompt: useCaching ? fullPrompt.slice(cachePrefix.length) : finalPrompt,
        apiKey,
        structuredOutput: {
          name: 'editor_questions',
          description: "Aparture editor's questions for the reader",
          schema: editorQuestionsJsonSchema(),
        },
        ...(useCaching ? { cachePrefix, cacheable: true } : {}),
      },
      callMode
    );

    if (!response.structured) {
      res.status(502).json({ error: 'model did not return structured output' });
      return;
    }

    const allowedIds = [...papers, ...nearMisses].map((p) => p?.arxivId).filter(Boolean);
    const { questions, dropped } = validateEditorQuestions(response.structured, allowedIds);
    res.status(200).json({
      questions,
      dropped,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      cacheReadTok: response.cacheReadTok ?? 0,
    });
  } catch (err) {
    if (sendRefusalErrorResponse(res, err)) return;
    if (sendProviderErrorResponse(res, err)) return;
    res
      .status(500)
      .json({ error: 'editor questions failed', details: String(err?.message ?? err) });
  }
}
