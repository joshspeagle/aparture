import { callModel } from '../../lib/llm/callModel.js';
import { extractJsonFromLlmOutput } from '../../utils/json.js';
import { loadRubricPrompt } from '../../lib/llm/loadRubricPrompt.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

function checkPassword(password) {
  return password === process.env.ACCESS_PASSWORD;
}

// Object-rooted schema (OpenAI strict json_schema rejects top-level arrays).
// Portable subset only: type/properties/required/items/enum + additionalProperties
// (Google adapter strips additionalProperties; Anthropic + OpenAI require it).
// Value-level constraints (count, index range, non-empty strings) live in
// validateFilterResponse below — Anthropic/OpenAI strict reject numeric/length
// constraints in schemas with 400, so they can't be expressed here.
function filterResponseJsonSchema() {
  return {
    type: 'object',
    required: ['verdicts'],
    additionalProperties: false,
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['paperIndex', 'verdict', 'summary', 'justification'],
          additionalProperties: false,
          properties: {
            paperIndex: { type: 'integer' },
            verdict: { type: 'string', enum: ['YES', 'NO', 'MAYBE'] },
            summary: { type: 'string' },
            justification: { type: 'string' },
          },
        },
      },
    },
  };
}

// Validates a parsed verdicts array. Accepts either the wrapped object form
// {verdicts: [...]} or a bare array (for backwards-compatible fallback when the
// provider returned unwrapped output).
function validateFilterResponse(parsed, expectedCount) {
  const verdicts = Array.isArray(parsed) ? parsed : parsed?.verdicts;
  if (!Array.isArray(verdicts)) {
    return {
      isValid: false,
      errors: ['Response is not an array (and not {verdicts: [...]})'],
      verdicts: [],
    };
  }

  const errors = [];
  if (verdicts.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} verdicts, got ${verdicts.length}`);
  }

  const validVerdicts = ['YES', 'NO', 'MAYBE'];
  const seenIndices = new Set();
  verdicts.forEach((item, i) => {
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
    if (!validVerdicts.includes(item?.verdict)) {
      errors.push(`Item ${i}: verdict must be YES, NO, or MAYBE (got: ${item?.verdict})`);
    }
    if (typeof item?.summary !== 'string' || item.summary.trim().length === 0) {
      errors.push(`Item ${i}: summary must be a non-empty string`);
    }
    if (typeof item?.justification !== 'string' || item.justification.trim().length === 0) {
      errors.push(`Item ${i}: justification must be a non-empty string`);
    }
  });

  return { isValid: errors.length === 0, errors, verdicts };
}

// Normalize a callModel result to a parsed payload. Prefer the provider's
// native structured output; fall back to parsing the text field.
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
      (p, idx) => `Paper ${idx + 1}:
Title: ${p.title}
Abstract: ${p.abstract || 'No abstract available'}`
    )
    .join('\n\n');
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
    name: 'filter_response',
    description: 'Aparture quick-filter batch verdicts',
    schema: filterResponseJsonSchema(),
  };

  try {
    let responseText;
    let parsed;

    if (correctionPrompt) {
      // Client-triggered correction: send the provided prompt as-is, but still
      // pass structuredOutput so the retry produces schema-valid JSON.
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
      // Normal path: cached prefix + variable tail.
      const { cachePrefix, variableTail } = await loadRubricPrompt(
        'rubric-filter.md',
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

      // Backend auto-correction: if the first response fails validation, re-run
      // with the ORIGINAL prompt body (papers + profile) plus an error hint so
      // the model still has the full context. The old design passed only the
      // broken prose to the correction call, which forced it to fabricate
      // verdicts blindly.
      const validation = validateFilterResponse(parsed, expectedCount);
      if (!validation.isValid) {
        console.log('Initial filter response validation failed:', validation.errors);
        const errorHint = [
          '',
          '# RETRY NOTICE',
          'Your previous output had these issues:',
          ...validation.errors.map((e) => `- ${e}`),
          `Regenerate the complete response now. Return exactly ${expectedCount} verdicts,`,
          'one per paper in the input list above, with paperIndex values 1..' + expectedCount + '.',
        ].join('\n');
        const retryPrompt = (promptOverride ?? variableTail) + errorHint;
        const correctedResult = await callModel(
          {
            provider,
            model: modelApiId,
            prompt: retryPrompt,
            cachePrefix: useCaching ? cachePrefix : '',
            cacheable: false, // don't write cache for retry
            apiKey,
            structuredOutput,
          },
          callMode
        );
        responseText = correctedResult.text;
        parsed = extractParsed(correctedResult);
      }
    }

    // Final validation — fail hard so the client's makeRobustAPICall triggers
    // its retry loop instead of silently accepting bad data.
    const finalValidation = validateFilterResponse(parsed, expectedCount);
    if (!finalValidation.isValid) {
      return res.status(502).json({
        error: 'filter validation failed after correction',
        errors: finalValidation.errors,
        rawResponse: responseText,
      });
    }

    // Return unwrapped array for backwards compat with the client contract.
    res.status(200).json({
      verdicts: finalValidation.verdicts,
      rawResponse: responseText,
    });
  } catch (error) {
    console.error('Error filtering papers:', error);
    res.status(500).json({
      error: 'Failed to filter papers',
      details: error.message,
    });
  }
}
