import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { callModel } from '../../lib/llm/callModel.js';
import { resolveApiKey } from '../../lib/llm/resolveApiKey.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

// Zod schema for the hallucination check structured output
const CheckBriefingSchema = z.object({
  verdict: z.enum(['YES', 'MAYBE', 'NO']),
  justification: z.string(),
  flaggedClaims: z.array(
    z.object({
      excerpt: z.string(),
      paperArxivId: z.string(),
      concern: z.string(),
    })
  ),
});

function checkBriefingJsonSchema() {
  return {
    type: 'object',
    required: ['verdict', 'justification', 'flaggedClaims'],
    properties: {
      verdict: { type: 'string', enum: ['YES', 'MAYBE', 'NO'] },
      justification: { type: 'string' },
      flaggedClaims: {
        type: 'array',
        items: {
          type: 'object',
          required: ['excerpt', 'paperArxivId', 'concern'],
          properties: {
            excerpt: { type: 'string' },
            paperArxivId: { type: 'string' },
            concern: { type: 'string' },
          },
        },
      },
    },
  };
}

function renderBriefingText(briefing) {
  // Compact text rendering of the briefing for the audit prompt.
  const parts = [];
  if (briefing?.executiveSummary) {
    parts.push(`EXECUTIVE SUMMARY:\n${briefing.executiveSummary}`);
  }
  if (Array.isArray(briefing?.themes) && briefing.themes.length > 0) {
    parts.push(
      `THEMES:\n${briefing.themes
        .map(
          (t, i) =>
            `  ${i + 1}. ${t.title ?? ''}\n     paperIds: [${(t.paperIds ?? []).join(', ')}]\n     argument: ${t.argument ?? ''}`
        )
        .join('\n')}`
    );
  }
  if (Array.isArray(briefing?.papers) && briefing.papers.length > 0) {
    parts.push(
      `PAPERS:\n${briefing.papers
        .map(
          (p) =>
            `  - ${p.arxivId} "${p.title ?? ''}"\n     onelinePitch: ${p.onelinePitch ?? ''}\n     whyMatters: ${p.whyMatters ?? ''}`
        )
        .join('\n')}`
    );
  }
  if (Array.isArray(briefing?.debates) && briefing.debates.length > 0) {
    parts.push(
      `DEBATES:\n${briefing.debates
        .map(
          (d, i) =>
            `  ${i + 1}. ${d.title ?? ''}\n     paperIds: [${(d.paperIds ?? []).join(', ')}]\n     summary: ${d.summary ?? ''}`
        )
        .join('\n')}`
    );
  }
  if (Array.isArray(briefing?.longitudinal) && briefing.longitudinal.length > 0) {
    parts.push(
      `LONGITUDINAL:\n${briefing.longitudinal
        .map((l, i) => `  ${i + 1}. ${l.summary ?? JSON.stringify(l)}`)
        .join('\n')}`
    );
  }
  return parts.join('\n\n');
}

function renderPapersCorpus(papers) {
  if (!Array.isArray(papers) || papers.length === 0) return '(no papers)';
  return papers
    .map((p) => {
      const lines = [`- ${p.arxivId} "${p.title ?? ''}"`];
      if (p.abstract) lines.push(`  Abstract: ${p.abstract}`);
      if (p.quickSummary) lines.push(`  Quick summary: ${p.quickSummary}`);
      if (p.fullReport) {
        // Truncate very long full reports to keep the audit prompt bounded.
        const truncated =
          p.fullReport.length > 4000
            ? `${p.fullReport.slice(0, 4000)}\n[...truncated]`
            : p.fullReport;
        lines.push(`  Full report: ${truncated}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function buildRepairPrompt({ originalResponse, errors }) {
  return [
    'You previously emitted a briefing hallucination check that failed validation. Here is the original output:',
    '```json',
    JSON.stringify(originalResponse, null, 2),
    '```',
    '',
    'The following validation errors were detected:',
    errors.map((e) => `- ${e}`).join('\n'),
    '',
    'Please emit a corrected check that (a) conforms to the schema {verdict: "YES"|"MAYBE"|"NO", justification: string, flaggedClaims: [{excerpt, paperArxivId, concern}]}, (b) preserves the substance of your original audit. Respond with the corrected structured output.',
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const {
    briefing,
    papers,
    model: briefingModel,
    provider,
    apiKey: clientApiKey,
    password,
    callModelMode,
  } = req.body ?? {};

  const resolved = resolveApiKey({ clientApiKey, password, provider });
  if (resolved.error) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const apiKey = resolved.apiKey;

  if (!briefing || !Array.isArray(papers) || !briefingModel || !provider) {
    res.status(400).json({
      error: 'missing required fields: briefing, papers (array), model, provider',
    });
    return;
  }

  if (!apiKey) {
    res.status(401).json({ error: 'missing apiKey or password' });
    return;
  }

  // Model ID translation (user-facing → apiId)
  const registryEntry = MODEL_REGISTRY[briefingModel];
  const modelApiId = registryEntry?.apiId ?? briefingModel;

  try {
    const templatePath = path.resolve(process.cwd(), 'prompts', 'check-briefing.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const fullPrompt = template
      .replace('{{briefing}}', renderBriefingText(briefing))
      .replace('{{papers}}', renderPapersCorpus(papers));

    // The stable cache prefix is the template text before {{briefing}} (the static
    // instructions). The variable tail is the rendered briefing + papers content.
    const briefingSlotIdx = template.indexOf('{{briefing}}');
    const cachePrefix = briefingSlotIdx >= 0 ? template.slice(0, briefingSlotIdx) : '';

    // APARTURE_TEST_CHECK_PROMPT_OVERRIDE replaces the full prompt for fixture-based
    // tests. When active (or when running in fixture mode), disable caching so the
    // fixture hash keys only on {provider, model, prompt, apiKey} — a stable value.
    const promptOverride = process.env.APARTURE_TEST_CHECK_PROMPT_OVERRIDE;
    const callMode = callModelMode ?? { mode: 'live' };
    const isFixture = callMode.mode === 'fixture';
    const useCaching = provider === 'anthropic' && !promptOverride && !isFixture;
    const finalPrompt = promptOverride ?? fullPrompt;
    const variableTail = useCaching ? fullPrompt.slice(cachePrefix.length) : finalPrompt;

    const jsonSchema = checkBriefingJsonSchema();

    // First call
    const response = await callModel(
      {
        provider,
        model: modelApiId,
        prompt: useCaching ? variableTail : finalPrompt,
        apiKey,
        structuredOutput: {
          name: 'briefing_hallucination_check',
          description: 'Aparture briefing hallucination audit result',
          schema: jsonSchema,
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
    const firstCheck = CheckBriefingSchema.safeParse(response.structured);
    if (firstCheck.success) {
      const data = firstCheck.data;
      res.status(200).json({
        verdict: data.verdict,
        justification: data.justification,
        flaggedClaims: data.flaggedClaims,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        repaired: false,
      });
      return;
    }

    // Two-pass repair
    const firstErrors = firstCheck.error.issues.map(
      (i) => `schema: ${i.path.join('.')} ${i.message}`
    );
    const repairPrompt = buildRepairPrompt({
      originalResponse: response.structured,
      errors: firstErrors,
    });

    const repaired = await callModel(
      {
        provider,
        model: modelApiId,
        prompt: repairPrompt,
        apiKey,
        structuredOutput: {
          name: 'briefing_hallucination_check',
          description: 'Aparture briefing hallucination audit result',
          schema: jsonSchema,
        },
      },
      callMode
    );

    if (!repaired?.structured) {
      res.status(500).json({
        error: 'repair callModel returned no structured output',
        originalValidationErrors: firstErrors,
      });
      return;
    }

    const secondCheck = CheckBriefingSchema.safeParse(repaired.structured);
    if (!secondCheck.success) {
      const secondErrors = secondCheck.error.issues.map(
        (i) => `schema: ${i.path.join('.')} ${i.message}`
      );
      res.status(500).json({
        error: 'check-briefing validation failed after repair',
        originalValidationErrors: firstErrors,
        repairValidationErrors: secondErrors,
      });
      return;
    }

    const data = secondCheck.data;
    res.status(200).json({
      verdict: data.verdict,
      justification: data.justification,
      flaggedClaims: data.flaggedClaims,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      repaired: true,
      originalValidationErrors: firstErrors,
    });
  } catch (err) {
    res.status(500).json({ error: 'check-briefing failed', details: String(err?.message ?? err) });
  }
}
