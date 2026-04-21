import { callModel } from '../../lib/llm/callModel.js';
import { extractJsonFromLlmOutput } from '../../utils/json.js';
import { loadRubricPrompt } from '../../lib/llm/loadRubricPrompt.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

function checkPassword(password) {
  return password === process.env.ACCESS_PASSWORD;
}

// Object-rooted schema (OpenAI strict json_schema rejects top-level arrays).
// Portable subset only; value constraints enforced in validateRescoreResponse.
function rescoreResponseJsonSchema() {
  return {
    type: 'object',
    required: ['rescores'],
    additionalProperties: false,
    properties: {
      rescores: {
        type: 'array',
        items: {
          type: 'object',
          required: ['paperIndex', 'adjustedScore', 'adjustmentReason', 'confidence'],
          additionalProperties: false,
          properties: {
            paperIndex: { type: 'integer' },
            adjustedScore: { type: 'number' },
            adjustmentReason: { type: 'string' },
            confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          },
        },
      },
    },
  };
}

function validateRescoreResponse(parsed, expectedCount) {
  const rescores = Array.isArray(parsed) ? parsed : parsed?.rescores;
  if (!Array.isArray(rescores)) {
    return {
      isValid: false,
      errors: ['Response is not an array (and not {rescores: [...]})'],
      rescores: [],
    };
  }

  const errors = [];
  if (rescores.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} rescores, got ${rescores.length}`);
  }

  const seenIndices = new Set();
  rescores.forEach((item, i) => {
    if (typeof item?.paperIndex !== 'number') {
      errors.push(`Item ${i}: paperIndex is not a number`);
    } else {
      if (item.paperIndex < 1 || item.paperIndex > expectedCount) {
        errors.push(`Item ${i}: paperIndex ${item.paperIndex} out of range [1..${expectedCount}]`);
      }
      if (seenIndices.has(item.paperIndex)) {
        errors.push(`Item ${i}: duplicate paperIndex ${item.paperIndex}`);
      }
      seenIndices.add(item.paperIndex);
    }
    if (
      typeof item?.adjustedScore !== 'number' ||
      item.adjustedScore < 0 ||
      item.adjustedScore > 10
    ) {
      errors.push(`Item ${i}: adjustedScore is not a valid number (0-10)`);
    }
    if (typeof item?.adjustmentReason !== 'string' || item.adjustmentReason.length < 10) {
      errors.push(`Item ${i}: adjustmentReason is missing or too short`);
    }
    if (
      typeof item?.confidence !== 'string' ||
      !['HIGH', 'MEDIUM', 'LOW'].includes(item.confidence)
    ) {
      errors.push(`Item ${i}: confidence must be HIGH, MEDIUM, or LOW`);
    }
  });

  return { isValid: errors.length === 0, errors, rescores };
}

function extractParsed(result) {
  if (result?.structured !== undefined && result.structured !== null) {
    return result.structured;
  }
  try {
    const cleaned = extractJsonFromLlmOutput(result?.text ?? '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function formatPapersForBatch(papers) {
  return papers
    .map(
      (p, idx) => `
Paper ${idx + 1}:
Title: ${p.title}
Abstract: ${p.abstract}
Initial Score: ${p.initialScore}/10
Initial Justification: ${p.initialJustification}
`
    )
    .join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    papers,
    scoringCriteria,
    password,
    apiKey: clientApiKey,
    model,
    correctionPrompt,
    callModelMode,
  } = req.body ?? {};

  const modelToUse = model || 'gemini-3-flash';
  const modelConfig = MODEL_REGISTRY[modelToUse];
  const provider = (modelConfig?.provider ?? 'Google').toLowerCase();
  const modelApiId = modelConfig?.apiId ?? modelToUse;

  let apiKey = clientApiKey;
  if (!apiKey && password) {
    if (!checkPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    if (provider === 'anthropic') apiKey = process.env.CLAUDE_API_KEY;
    else if (provider === 'google') apiKey = process.env.GOOGLE_AI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
  }

  if (!apiKey && (callModelMode?.mode ?? 'live') !== 'fixture') {
    return res.status(401).json({ error: 'missing credentials' });
  }

  const callMode = callModelMode ?? { mode: 'live' };
  const isFixture = callMode.mode === 'fixture';
  const cacheable = provider === 'anthropic';
  const expectedCount = (papers ?? []).length;

  const structuredOutput = {
    name: 'rescore_response',
    description: 'Aparture batch paper rescoring results',
    schema: rescoreResponseJsonSchema(),
  };

  try {
    let responseText;
    let parsed;

    if (correctionPrompt) {
      const finalPrompt = process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? correctionPrompt;
      const result = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: finalPrompt,
          cachePrefix: '',
          cacheable: false,
          apiKey,
          structuredOutput,
        },
        callMode
      );
      responseText = result.text;
      parsed = extractParsed(result);
    } else {
      const { cachePrefix, variableTail } = await loadRubricPrompt(
        'rubric-rescoring.md',
        { profile: scoringCriteria ?? '' },
        { papers: formatPapersForBatch(papers ?? []) }
      );
      const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
      const finalPrompt = promptOverride ?? variableTail;
      const useCaching = cacheable && !isFixture && !promptOverride;

      const result = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: finalPrompt,
          cachePrefix: useCaching ? cachePrefix : '',
          cacheable: useCaching,
          apiKey,
          structuredOutput,
        },
        callMode
      );
      responseText = result.text;
      parsed = extractParsed(result);

      const validation = validateRescoreResponse(parsed, expectedCount);
      if (!validation.isValid) {
        console.log('Initial rescore response validation failed:', validation.errors);
        const errorHint = [
          '',
          '# RETRY NOTICE',
          'Your previous output had these issues:',
          ...validation.errors.map((e) => `- ${e}`),
          `Regenerate the complete response now. Return exactly ${expectedCount} rescores,`,
          'one per paper in the input list above, with paperIndex values 1..' + expectedCount + '.',
        ].join('\n');
        const retryPrompt = (promptOverride ?? variableTail) + errorHint;
        const correctedResult = await callModel(
          {
            provider,
            model: modelApiId,
            prompt: retryPrompt,
            cachePrefix: useCaching ? cachePrefix : '',
            cacheable: false,
            apiKey,
            structuredOutput,
          },
          callMode
        );
        responseText = correctedResult.text;
        parsed = extractParsed(correctedResult);
      }
    }

    const finalValidation = validateRescoreResponse(parsed, expectedCount);
    if (!finalValidation.isValid) {
      return res.status(502).json({
        error: 'rescore validation failed after correction',
        errors: finalValidation.errors,
        rawResponse: responseText,
      });
    }

    res.status(200).json({
      rescores: finalValidation.rescores,
      rawResponse: responseText,
    });
  } catch (error) {
    console.error('Error rescoring abstracts:', error);
    res.status(500).json({
      error: 'Failed to rescore abstracts',
      details: error.message,
    });
  }
}
