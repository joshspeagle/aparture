import { callModel } from '../../lib/llm/callModel.js';
import { extractJsonFromLlmOutput } from '../../utils/json.js';
import { loadRubricPrompt, buildRetryPrompt } from '../../lib/llm/loadRubricPrompt.js';
import { sendProviderErrorResponse } from '../../lib/llm/ProviderError.js';
import { resolveCallModelMode } from '../../lib/llm/resolveCallModelMode.js';
import { MODEL_REGISTRY } from '../../utils/models.js';
import { checkAccessPassword } from '../../lib/auth/checkAccessPassword.js';

// Object-rooted schema (OpenAI strict json_schema rejects top-level arrays).
// Portable subset only; value constraints enforced in validateScoringResponse.
function scoringResponseJsonSchema() {
  return {
    type: 'object',
    required: ['scores'],
    additionalProperties: false,
    properties: {
      scores: {
        type: 'array',
        items: {
          type: 'object',
          required: ['paperIndex', 'score', 'justification'],
          additionalProperties: false,
          properties: {
            paperIndex: { type: 'integer' },
            score: { type: 'number' },
            justification: { type: 'string' },
          },
        },
      },
    },
  };
}

function validateScoringResponse(parsed, expectedCount) {
  const scores = Array.isArray(parsed) ? parsed : parsed?.scores;
  if (!Array.isArray(scores)) {
    return {
      isValid: false,
      errors: ['Response is not an array (and not {scores: [...]})'],
      scores: [],
    };
  }

  const errors = [];
  if (scores.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} scores, got ${scores.length}`);
  }

  const seenIndices = new Set();
  scores.forEach((item, i) => {
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
    if (typeof item?.score !== 'number' || item.score < 0 || item.score > 10) {
      errors.push(`Item ${i}: score is not a valid number (0-10)`);
    }
    if (typeof item?.justification !== 'string' || item.justification.length < 10) {
      errors.push(`Item ${i}: justification is missing or too short`);
    }
  });

  return { isValid: errors.length === 0, errors, scores };
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
    .map((p, idx) => `Paper ${idx + 1}: Title: ${p.title} Abstract: ${p.abstract}`)
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
  // Validate the password BEFORE the empty-papers shortcut so a bad password
  // never authenticates, but resolve the provider key AFTER it. App.jsx's
  // login probe POSTs `{ papers: [], password }` with no model, so `provider`
  // defaults to Google; resolving the Google key here would 401 a user who
  // only has CLAUDE_API_KEY / OPENAI_API_KEY set. The empty-papers path needs
  // no provider key at all — it never calls the model.
  if (!apiKey && password && !checkAccessPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Early return if no papers to score (used by App.jsx to verify password
  // during login). Placed before the provider-credential check so a correct
  // password authenticates regardless of which provider key is configured.
  if (!papers || papers.length === 0) {
    return res.status(200).json({ scores: [], rawResponse: '[]' });
  }

  if (!apiKey && password) {
    if (provider === 'anthropic') apiKey = process.env.CLAUDE_API_KEY;
    else if (provider === 'google') apiKey = process.env.GOOGLE_AI_API_KEY;
    else if (provider === 'openai') apiKey = process.env.OPENAI_API_KEY;
  }

  // Client-supplied fixture mode is honored only under NODE_ENV === 'test'
  // (see resolveCallModelMode); in production it is forced back to live.
  const callMode = resolveCallModelMode(callModelMode);
  if (!apiKey && callMode.mode !== 'fixture') {
    return res.status(401).json({ error: 'missing credentials' });
  }

  const isFixture = callMode.mode === 'fixture';
  const cacheable = provider === 'anthropic';

  const expectedCount = papers.length;
  const structuredOutput = {
    name: 'scoring_response',
    description: 'Aparture batch paper scoring results',
    schema: scoringResponseJsonSchema(),
  };

  try {
    let responseText;
    let parsed;

    // Token usage summed across every provider call this request makes
    // (initial + backend auto-correction), returned on the 200 body so the
    // client can accumulate per-stage cost.
    const usage = { tokensIn: 0, tokensOut: 0, cacheReadTok: 0 };
    const addUsage = (r) => {
      usage.tokensIn += r?.tokensIn ?? 0;
      usage.tokensOut += r?.tokensOut ?? 0;
      usage.cacheReadTok += r?.cacheReadTok ?? 0;
    };

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
      addUsage(result);
    } else {
      const { cachePrefix, variableTail } = await loadRubricPrompt(
        'rubric-scoring.md',
        { profile: scoringCriteria ?? '' },
        { papers: formatPapersForBatch(papers) }
      );
      const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
      const useCaching = cacheable && !isFixture && !promptOverride;
      // When not caching, the rubric + profile must be in `prompt` or the
      // model never sees them (variableTail alone is just the papers section).
      const finalPrompt =
        promptOverride ?? (useCaching ? variableTail : cachePrefix + variableTail);

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
      addUsage(result);

      const validation = validateScoringResponse(parsed, expectedCount);
      if (!validation.isValid) {
        console.log('Initial scoring response validation failed:', validation.errors);
        const errorHint = [
          '',
          '# RETRY NOTICE',
          'Your previous output had these issues:',
          ...validation.errors.map((e) => `- ${e}`),
          `Regenerate the complete response now. Return exactly ${expectedCount} scores,`,
          'one per paper in the input list above, with paperIndex values 1..' + expectedCount + '.',
        ].join('\n');
        // Retry is always uncached, so the body must be self-contained: it
        // always inlines the rubric + profile prefix (the Anthropic adapter
        // ignores cachePrefix when cacheable is false, so cachePrefix here
        // would be silently dropped for live Anthropic). See buildRetryPrompt.
        const retryBody = buildRetryPrompt({ promptOverride, cachePrefix, variableTail });
        const retryPrompt = retryBody + errorHint;
        const correctedResult = await callModel(
          {
            provider,
            model: modelApiId,
            prompt: retryPrompt,
            cachePrefix: '',
            cacheable: false,
            apiKey,
            structuredOutput,
          },
          callMode
        );
        responseText = correctedResult.text;
        parsed = extractParsed(correctedResult);
        addUsage(correctedResult);
      }
    }

    const finalValidation = validateScoringResponse(parsed, expectedCount);
    if (!finalValidation.isValid) {
      return res.status(502).json({
        error: 'scoring validation failed after correction',
        errors: finalValidation.errors,
        rawResponse: responseText,
      });
    }

    res.status(200).json({
      scores: finalValidation.scores,
      rawResponse: responseText,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      cacheReadTok: usage.cacheReadTok,
    });
  } catch (error) {
    console.error('Error scoring abstracts:', error);
    if (sendProviderErrorResponse(res, error)) return;
    res.status(500).json({
      error: 'Failed to score abstracts',
      details: error.message,
    });
  }
}
