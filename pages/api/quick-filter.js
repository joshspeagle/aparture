import { callModel } from '../../lib/llm/callModel.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

function checkPassword(password) {
  return password === process.env.ACCESS_PASSWORD;
}

// Function to validate filter response structure
function validateFilterResponse(responseText, expectedCount) {
  try {
    const parsed = JSON.parse(responseText);

    if (!Array.isArray(parsed)) {
      return { isValid: false, errors: ['Response is not an array'] };
    }

    const errors = [];

    // Check if we have the right number of responses
    if (parsed.length !== expectedCount) {
      errors.push(`Expected ${expectedCount} verdicts, got ${parsed.length}`);
    }

    // Validate each verdict
    const validVerdicts = ['YES', 'NO', 'MAYBE'];
    parsed.forEach((item, index) => {
      if (typeof item.paperIndex !== 'number') {
        errors.push(`Item ${index}: paperIndex is not a number`);
      }
      if (!validVerdicts.includes(item.verdict)) {
        errors.push(`Item ${index}: verdict must be YES, NO, or MAYBE (got: ${item.verdict})`);
      }
      if (typeof item.summary !== 'string' || item.summary.trim().length === 0) {
        errors.push(`Item ${index}: summary must be a non-empty string`);
      }
      if (typeof item.justification !== 'string' || item.justification.trim().length === 0) {
        errors.push(`Item ${index}: justification must be a non-empty string`);
      }
    });

    return { isValid: errors.length === 0, errors };
  } catch (e) {
    return { isValid: false, errors: ['Invalid JSON: ' + e.message] };
  }
}

/**
 * Build the static cacheable prefix: instruction block + user profile.
 * This portion is identical for every batch call with the same scoringCriteria,
 * making it a good candidate for Anthropic prompt caching.
 */
function buildCachePrefix(scoringCriteria) {
  return `You are a research assistant doing quick relevance screening of academic papers.

Research Interests:
${scoringCriteria}

For each paper below, produce three things:
1. A one-sentence SUMMARY of what the paper is actually about, so the user can tell at a glance whether the model understood it correctly.
2. A VERDICT: YES (clearly relevant), NO (clearly not relevant), or MAYBE (possibly relevant, needs closer look).
3. A one-sentence JUSTIFICATION explaining the verdict with reference to the research interests above. Be specific — "aligns with mechanistic interpretability" is better than "relevant".

FILTERING GUIDANCE:
- YES: Papers that clearly align with the specified research interests
- NO: Papers clearly outside the research areas or using fundamentally different approaches
- MAYBE: Papers with potential relevance that need deeper review (borderline cases). **Prefer MAYBE over NO when the abstract is ambiguous** — dismissed papers are expensive to recover, so err on the side of passing through borderline cases. Reserve NO for clear mismatches.
- Focus on the specific criteria provided, not general AI/ML relevance.
- Consider interdisciplinary connections only if they relate to the stated interests.
- Ground every justification in the paper's abstract, not in guesses about what the title implies.

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "paperIndex": 1,
    "verdict": "YES",
    "summary": "One-sentence summary of what Paper 1 is about.",
    "justification": "One-sentence reason for the verdict, citing the research interests."
  },
  {
    "paperIndex": 2,
    "verdict": "NO",
    "summary": "One-sentence summary of what Paper 2 is about.",
    "justification": "One-sentence reason for the verdict."
  },
  {
    "paperIndex": 3,
    "verdict": "MAYBE",
    "summary": "One-sentence summary of what Paper 3 is about.",
    "justification": "One-sentence reason for the verdict."
  }
]

Your entire response MUST ONLY be a single, valid JSON array.`;
}

/**
 * Build the variable per-batch tail: the list of papers to screen.
 */
function buildBatchPrompt(papers) {
  return `Papers to screen:
${papers
  .map(
    (p, idx) => `Paper ${idx + 1}:
Title: ${p.title}
Abstract: ${p.abstract || 'No abstract available'}`
  )
  .join('\n\n')}`;
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
  const modelConfig = MODEL_REGISTRY[model];
  const provider = (modelConfig?.provider ?? 'Google').toLowerCase();
  const modelApiId = modelConfig?.apiId ?? model;

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
      const cachePrefix = buildCachePrefix(scoringCriteria ?? '');
      const batchPrompt = buildBatchPrompt(papers ?? []);
      // APARTURE_TEST_PROMPT_OVERRIDE replaces the variable tail for fixture-based
      // tests. When the override is active, disable caching so the fixture hash
      // keys only on {provider, model, prompt, apiKey} — a predictable value.
      const promptOverride = process.env.APARTURE_TEST_PROMPT_OVERRIDE;
      const finalPrompt = promptOverride ?? batchPrompt;
      const useCaching = cacheable && !promptOverride;

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
    let cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Always validate response structure (not just on parse failure)
    const validation = validateFilterResponse(cleanedText, (papers ?? []).length);

    // If validation fails and this isn't already a correction attempt, try to correct
    if (!validation.isValid && !correctionPrompt) {
      console.log('Initial filter response validation failed:', validation.errors);

      // Build correction prompt with specific errors
      const correctionRequest = `The previous response had formatting/structure errors:
${validation.errors.join('\n')}

Original response:
${cleanedText}

Please provide a corrected response with exactly ${(papers ?? []).length} filter verdicts.
Each item must have: paperIndex (number), verdict ("YES", "NO", or "MAYBE"), summary (non-empty string), justification (non-empty string).

Your entire response MUST ONLY be a valid JSON array in this exact format:
[
  {
    "paperIndex": 1,
    "verdict": "YES",
    "summary": "One-sentence summary of what the paper is about.",
    "justification": "One-sentence reason for the verdict."
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
      cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    }

    let verdicts;
    try {
      verdicts = JSON.parse(cleanedText);

      // Final validation even after correction
      const finalValidation = validateFilterResponse(cleanedText, (papers ?? []).length);
      if (!finalValidation.isValid) {
        console.warn('Filter response still invalid after correction:', finalValidation.errors);
      }
    } catch (parseError) {
      // If this is a correction attempt that still failed, return the raw response for debugging
      if (correctionPrompt) {
        return res.status(200).json({
          verdicts: [],
          rawResponse: responseText,
          error: `Correction parsing failed: ${parseError.message}`,
        });
      }
      throw parseError;
    }

    // Return both the parsed verdicts and the raw response
    res.status(200).json({
      verdicts,
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
