// Slim orchestrator: composes lib/notebooklm/* helpers and streams a
// ZIP containing the NotebookLM source bundle. The LLM call (via
// callModel) is the only I/O in the guide-generation path; everything
// else is pure.
//
// Previous versions of this file contained a ~280-line regex-based
// hallucination detector and a two-pass clean/strict prompt retry
// loop. Both have been removed — the upstream briefing synthesis
// already runs a dedicated hallucination check, and the new source
// split (briefing + per-paper reports as separate uploads) gives
// NotebookLM ground truth without the discussion guide having to
// re-state it.

import fs from 'node:fs';
import path from 'node:path';
import { callModel } from '../../lib/llm/callModel.js';
import { MODEL_REGISTRY } from '../../utils/models.js';
import { renderBriefingMarkdown } from '../../lib/notebooklm/renderBriefingMarkdown.js';
import { renderPaperReport } from '../../lib/notebooklm/renderPaperReport.js';
import { buildFocusPrompt } from '../../lib/notebooklm/buildFocusPrompt.js';
import { bundleZip } from '../../lib/notebooklm/bundleZip.js';
import { INSTRUCTIONS_MD } from '../../lib/notebooklm/instructions.js';

const GUIDE_PROMPT_PATH = path.join(process.cwd(), 'prompts/notebooklm-discussion-guide.md');

function checkPassword(password) {
  return password === process.env.ACCESS_PASSWORD;
}

function renderGuidePrompt(template, { themes, papers, duration, date }) {
  return template
    .replaceAll('{{themes}}', JSON.stringify(themes, null, 2))
    .replaceAll('{{papers}}', JSON.stringify(papers, null, 2))
    .replaceAll('{{duration}}', String(duration))
    .replaceAll('{{date}}', date);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    briefing,
    papers = [],
    podcastDuration = 20,
    notebookLMModel,
    provider,
    password,
    apiKey,
    date,
    callModelMode,
  } = req.body ?? {};

  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!briefing) {
    return res.status(400).json({ error: 'briefing is required' });
  }
  if (!Array.isArray(papers) || papers.length === 0) {
    return res.status(400).json({ error: 'papers array is required' });
  }

  const runDate = date ?? new Date().toISOString().slice(0, 10);
  const callMode = callModelMode ?? { mode: 'live' };

  try {
    const modelCfg = MODEL_REGISTRY[notebookLMModel];
    if (!modelCfg) {
      return res.status(400).json({ error: `unknown notebookLMModel: ${notebookLMModel}` });
    }
    const resolvedProvider = provider ?? (modelCfg.provider ?? 'Google').toLowerCase();

    const template = fs.readFileSync(GUIDE_PROMPT_PATH, 'utf8');
    const guidePrompt = renderGuidePrompt(template, {
      themes: briefing.themes ?? [],
      papers: (briefing.papers ?? []).map((p, i) => ({
        index: i + 1,
        arxivId: p.arxivId,
        title: p.title,
        score: p.score,
      })),
      duration: podcastDuration,
      date: runDate,
    });

    const finalPrompt = process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? guidePrompt;

    const llmResponse = await callModel(
      {
        provider: resolvedProvider,
        model: notebookLMModel,
        prompt: finalPrompt,
        apiKey,
      },
      callMode
    );
    const discussionGuide = llmResponse.text ?? llmResponse.response?.text ?? '';

    const briefingMd = renderBriefingMarkdown(briefing, { date: runDate });
    const focusPrompt = buildFocusPrompt(briefing, podcastDuration);
    const paperFiles = {};
    papers.forEach((p, i) => {
      const { filename, content } = renderPaperReport(p, i + 1);
      paperFiles[filename] = content;
    });

    const files = {
      'INSTRUCTIONS.md': INSTRUCTIONS_MD,
      'briefing.md': briefingMd,
      'discussion-guide.md': discussionGuide,
      'focus-prompt.txt': focusPrompt,
      ...paperFiles,
    };

    const zipBuf = await bundleZip(files);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aparture-notebooklm-${runDate}.zip"`
    );
    return res.status(200).send(zipBuf);
  } catch (err) {
    console.error('[notebooklm] generation failed:', err);
    return res.status(500).json({ error: err.message ?? 'generation failed' });
  }
}
