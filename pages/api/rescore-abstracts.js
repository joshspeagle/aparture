import { callModel } from '../../lib/llm/callModel.js';
import { extractJsonFromLlmOutput } from '../../utils/json.js';
import { loadRubricPrompt } from '../../lib/llm/loadRubricPrompt.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

function checkPassword(password) {
  return password === process.env.ACCESS_PASSWORD;
}

// Function to validate rescore response structure
function validateRescoreResponse(responseText, expectedCount) {
  try {
    const parsed = JSON.parse(responseText);

    if (!Array.isArray(parsed)) {
      return { isValid: false, errors: ['Response is not an array'] };
    }

    const errors = [];

    // Check if we have the right number of rescores
    if (parsed.length !== expectedCount) {
      errors.push(`Expected ${expectedCount} rescores, got ${parsed.length}`);
    }

    // Validate each rescore object
    parsed.forEach((item, index) => {
      if (typeof item.paperIndex !== 'number') {
        errors.push(`Item ${index}: paperIndex is not a number`);
      }
      if (
        typeof item.adjustedScore !== 'number' ||
        item.adjustedScore < 0 ||
        item.adjustedScore > 10
      ) {
        errors.push(`Item ${index}: adjustedScore is not a valid number (0-10)`);
      }
      if (typeof item.adjustmentReason !== 'string' || item.adjustmentReason.length < 10) {
        errors.push(`Item ${index}: adjustmentReason is missing or too short`);
      }
      if (
        typeof item.confidence !== 'string' ||
        !['HIGH', 'MEDIUM', 'LOW'].includes(item.confidence)
      ) {
        errors.push(`Item ${index}: confidence must be HIGH, MEDIUM, or LOW`);
      }
    });

    return { isValid: errors.length === 0, errors };
  } catch (e) {
    return { isValid: false, errors: ['Invalid JSON: ' + e.message] };
  }
}

/**
 * Build the static cacheable prefix: rescoring instructions + user profile.
 * This portion is identical for every batch call with the same scoringCriteria,
 * making it a good candidate for Anthropic prompt caching.
 */
/**
 * Format the per-batch paper list for the {{papers}} slot in rubric-rescoring.md.
 */
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

  // Resolve provider from model registry (needed before auth to pick env key)
  const modelToUse = model || 'gemini-3-flash';
  const modelConfig = MODEL_REGISTRY[modelToUse];
  const provider = (modelConfig?.provider ?? 'Google').toLowerCase();
  const modelApiId = modelConfig?.apiId ?? modelToUse;

  // Resolve API key: accept client-supplied key, or fall back to env vars via password auth
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

  try {
    let responseText;

    if (correctionPrompt) {
      // Correction path: pass the whole correction prompt as the variable tail,
      // no caching (cache misses are fine here since corrections are rare).
      const finalPrompt = process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? correctionPrompt;
      const result = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: finalPrompt,
          cachePrefix: '',
          cacheable: false,
          apiKey,
        },
        callMode
      );
      responseText = result.text;
    } else {
      // Normal path: split prompt into static prefix (cacheable) + variable tail.
      const { cachePrefix, variableTail } = await loadRubricPrompt(
        'rubric-rescoring.md',
        { profile: scoringCriteria ?? '' },
        { papers: formatPapersForBatch(papers ?? []) }
      );
      // APARTURE_TEST_PROMPT_OVERRIDE replaces the variable tail for fixture-based
      // tests. When the override is active, disable caching so the fixture hash
      // keys only on {provider, model, prompt, apiKey} — a predictable value.
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
        },
        callMode
      );
      responseText = result.text;
    }

    // Clean up response text (remove markdown formatting if present)
    let cleanedText = extractJsonFromLlmOutput(responseText);

    // Always validate response structure (not just on parse failure)
    const validation = validateRescoreResponse(cleanedText, (papers ?? []).length);

    // If validation fails and this isn't already a correction attempt, try to correct
    if (!validation.isValid && !correctionPrompt) {
      console.log('Initial rescore response validation failed:', validation.errors);

      // Build correction prompt with specific errors
      const correctionRequest = `The previous response had formatting/structure errors:
${validation.errors.join('\n')}

Original response:
${cleanedText}

Please provide a corrected response with exactly ${(papers ?? []).length} paper rescores.
Each item must have: paperIndex (number), adjustedScore (0.0-10.0), adjustmentReason (string), confidence (HIGH/MEDIUM/LOW).

Your entire response MUST ONLY be a valid JSON array in this exact format:
[
  {
    "paperIndex": 1,
    "adjustedScore": 5.5,
    "adjustmentReason": "Kept original score as it accurately reflects the paper's relevance",
    "confidence": "HIGH"
  }
]`;

      // Try correction (no caching for corrections)
      const finalCorrectionPrompt = process.env.APARTURE_TEST_PROMPT_OVERRIDE ?? correctionRequest;
      const correctedResult = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: finalCorrectionPrompt,
          cachePrefix: '',
          cacheable: false,
          apiKey,
        },
        callMode
      );
      responseText = correctedResult.text;
      cleanedText = extractJsonFromLlmOutput(responseText);
    }

    let rescores;
    try {
      rescores = JSON.parse(cleanedText);

      // Final validation even after correction
      const finalValidation = validateRescoreResponse(cleanedText, (papers ?? []).length);
      if (!finalValidation.isValid) {
        console.warn('Rescore response still invalid after correction:', finalValidation.errors);
      }
    } catch (parseError) {
      // If this is a correction attempt that still failed, return the raw response for debugging
      if (correctionPrompt) {
        return res.status(200).json({
          rescores: [],
          rawResponse: responseText,
          error: `Correction parsing failed: ${parseError.message}`,
        });
      }
      throw parseError;
    }

    // Return both the parsed rescores and the raw response
    res.status(200).json({
      rescores,
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
