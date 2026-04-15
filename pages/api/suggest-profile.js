import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { callModel } from '../../lib/llm/callModel.js';
import { resolveApiKey } from '../../lib/llm/resolveApiKey.js';
import { renderSuggestPrompt } from '../../lib/profile/suggestPrompt.js';
import { MODEL_REGISTRY } from '../../utils/models.js';

// Zod schema for the suggested profile structured output
const SuggestedProfileSchema = z.object({
  revisedProfile: z.string(),
  changes: z.array(
    z.object({
      excerpt: z.string(),
      rationale: z.string(),
    })
  ),
  noChangeReason: z.string().optional(),
});

// JSON Schema for provider-native structured output. Hand-written to mirror
// the lib/synthesis/schema.js approach.
function suggestedProfileJsonSchema() {
  return {
    type: 'object',
    required: ['revisedProfile', 'changes'],
    properties: {
      revisedProfile: { type: 'string' },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['excerpt', 'rationale'],
          properties: {
            excerpt: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      },
      noChangeReason: { type: 'string' },
    },
  };
}

function buildRepairPrompt({ originalSuggestion, errors }) {
  return [
    'You previously emitted a suggested profile revision that failed validation. Here is the original output:',
    '```json',
    JSON.stringify(originalSuggestion, null, 2),
    '```',
    '',
    'The following validation errors were detected:',
    errors.map((e) => `- ${e}`).join('\n'),
    '',
    'Please emit a corrected suggestion that (a) conforms to the schema {revisedProfile: string, changes: [{excerpt, rationale}], noChangeReason?: string}, (b) preserves the original intent and content as much as possible while fixing the errors, (c) does not invent new feedback events. Respond with the corrected structured suggestion.',
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const {
    currentProfile,
    feedback,
    briefingModel,
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

  if (
    typeof currentProfile !== 'string' ||
    !Array.isArray(feedback) ||
    !briefingModel ||
    !provider
  ) {
    res.status(400).json({
      error:
        'missing required fields: currentProfile (string), feedback (array), briefingModel, provider',
    });
    return;
  }

  if (!apiKey) {
    res.status(401).json({ error: 'missing apiKey or password' });
    return;
  }

  // Resolve briefingModel (user-facing ID) → apiId. If briefingModel is already
  // an apiId or unknown, fall through to using the provided value directly so
  // tests can pass apiIds directly.
  const registryEntry = MODEL_REGISTRY[briefingModel];
  const modelApiId = registryEntry?.apiId ?? briefingModel;

  try {
    // Load the suggest-profile prompt template
    const templatePath = path.resolve(process.cwd(), 'prompts', 'suggest-profile.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const prompt = renderSuggestPrompt(template, {
      profile: currentProfile,
      events: feedback,
    });
    const finalPrompt = process.env.APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE ?? prompt;

    const callMode = callModelMode ?? { mode: 'live' };
    const jsonSchema = suggestedProfileJsonSchema();

    // First call
    const response = await callModel(
      {
        provider,
        model: modelApiId,
        prompt: finalPrompt,
        apiKey,
        structuredOutput: {
          name: 'suggested_profile',
          description: 'Aparture suggested research profile revision',
          schema: jsonSchema,
        },
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
    const firstCheck = SuggestedProfileSchema.safeParse(response.structured);
    if (firstCheck.success) {
      const data = firstCheck.data;
      res.status(200).json({
        revisedProfile: data.revisedProfile,
        changes: data.changes,
        noChangeReason: data.noChangeReason,
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
      originalSuggestion: response.structured,
      errors: firstErrors,
    });

    const repaired = await callModel(
      {
        provider,
        model: modelApiId,
        prompt: repairPrompt,
        apiKey,
        structuredOutput: {
          name: 'suggested_profile',
          description: 'Aparture suggested research profile revision',
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

    const secondCheck = SuggestedProfileSchema.safeParse(repaired.structured);
    if (!secondCheck.success) {
      const secondErrors = secondCheck.error.issues.map(
        (i) => `schema: ${i.path.join('.')} ${i.message}`
      );
      res.status(500).json({
        error: 'suggest-profile validation failed after repair',
        originalValidationErrors: firstErrors,
        repairValidationErrors: secondErrors,
      });
      return;
    }

    const data = secondCheck.data;
    res.status(200).json({
      revisedProfile: data.revisedProfile,
      changes: data.changes,
      noChangeReason: data.noChangeReason,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      repaired: true,
      originalValidationErrors: firstErrors,
    });
  } catch (err) {
    res.status(500).json({ error: 'suggest-profile failed', details: String(err?.message ?? err) });
  }
}
