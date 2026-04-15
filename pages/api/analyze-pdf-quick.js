import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
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

  // Resolve API key: accept client-supplied key, or fall back to env vars via password auth
  let apiKey = clientApiKey;
  if (!apiKey && password) {
    if (password !== process.env.ACCESS_PASSWORD) {
      res.status(401).json({ error: 'invalid password' });
      return;
    }
    if (provider === 'anthropic') apiKey = process.env.CLAUDE_API_KEY;
    else if (provider === 'google') apiKey = process.env.GOOGLE_AI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
  }

  if (!paper?.arxivId || !fullReport || !provider || !model) {
    res.status(400).json({
      error: 'missing required fields: paper.arxivId, fullReport, provider, model',
    });
    return;
  }
  if (!apiKey) {
    res.status(401).json({ error: 'missing credentials: supply apiKey or password' });
    return;
  }

  try {
    const templatePath = path.resolve(process.cwd(), 'prompts', 'analyze-pdf-quick.md');
    const template = await fs.readFile(templatePath, 'utf8');

    const prompt = template
      .replaceAll('{{title}}', paper.title ?? '')
      .replaceAll('{{authors}}', (paper.authors ?? []).join(', '))
      .replaceAll('{{arxivId}}', paper.arxivId)
      .replaceAll('{{fullReport}}', fullReport)
      .replaceAll('{{abstract}}', paper.abstract ?? '')
      .replaceAll('{{scoringJustification}}', paper.scoringJustification ?? '');

    // Resolve user-facing model ID → apiId via MODEL_REGISTRY; fall through
    // unchanged if the caller already passed an apiId or an unknown value.
    const modelApiId = MODEL_REGISTRY[model]?.apiId ?? model;

    const response = await callModel(
      { provider, model: modelApiId, prompt, apiKey },
      callModelMode ?? { mode: 'live' }
    );

    res.status(200).json({
      arxivId: paper.arxivId,
      quickSummary: response.text.trim(),
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
    });
  } catch (err) {
    res.status(500).json({ error: 'quick summary failed', details: String(err?.message ?? err) });
  }
}
