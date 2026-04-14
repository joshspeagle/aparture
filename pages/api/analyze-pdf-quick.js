import fs from 'node:fs/promises';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { paper, fullReport, provider, model, apiKey, callModelMode } = req.body ?? {};

  if (!paper?.arxivId || !fullReport || !provider || !model || !apiKey) {
    res.status(400).json({
      error: 'missing required fields: paper.arxivId, fullReport, provider, model, apiKey',
    });
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

    const response = await callModel(
      { provider, model, prompt, apiKey },
      callModelMode ?? { mode: 'live' }
    );

    res.status(200).json({
      arxivId: paper.arxivId,
      quickSummary: response.text.trim(),
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
