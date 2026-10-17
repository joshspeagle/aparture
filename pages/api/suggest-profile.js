import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { callModel } from '../../lib/llm/callModel.js';
import { checkRoutePassword, resolveRouteAuth } from '../../lib/llm/resolveRouteAuth.js';
import { sendProviderErrorResponse } from '../../lib/llm/ProviderError.js';
import { sendRefusalErrorResponse } from '../../lib/llm/RefusalError.js';
import {
  renderSuggestPrompt,
  validateNonOverlappingChanges,
} from '../../lib/profile/suggestPrompt.js';
import { MODEL_REGISTRY } from '../../utils/models.js';
import {
  MAX_NOTES_PER_SCOPE,
  NOTE_SCOPES,
  normalizeNotes,
} from '../../lib/profile/editorialNotes.js';

// Zod schema for the per-hunk suggested profile structured output.
// `content` and `noChangeReason` are nullable rather than optional: OpenAI
// strict json_schema does not support optional properties (every property must
// appear in `required`), so the provider schema marks them as `["string",
// "null"]` and the model returns null when not applicable. Downstream usages
// already null-coerce (DiffPreview uses `edit.content ?? ''`, SuggestDialog
// uses `response.noChangeReason && ...`).
const SuggestProfileChangeSchema = z.object({
  id: z.string().min(1),
  rationale: z.string().min(1),
  edit: z.object({
    type: z.enum(['replace', 'insert', 'delete']),
    anchor: z.string().min(1),
    content: z
      .union([z.string(), z.null()])
      .transform((v) => v ?? '')
      .default(''),
  }),
});

// An editorial-note change (lib/profile/editorialNotes.js). Older fixtures
// and providers that omit the list parse as no note changes.
const NoteChangeSchema = z.object({
  id: z.string().min(1),
  rationale: z.string().min(1),
  action: z.enum(['add', 'revise', 'retire']),
  noteId: z.union([z.string(), z.null()]).default(null),
  scope: z.union([z.enum(NOTE_SCOPES), z.null()]).default(null),
  text: z.union([z.string(), z.null()]).default(null),
});

const SuggestedProfileSchema = z.object({
  changes: z.array(SuggestProfileChangeSchema),
  noteChanges: z.array(NoteChangeSchema).default([]),
  noChangeReason: z
    .union([z.string(), z.null()])
    .transform((v) => v ?? undefined)
    .optional(),
});

// JSON Schema for provider-native structured output. Hand-written to mirror
// the lib/synthesis/schema.js approach.
//
// `additionalProperties: false` is required on every object: OpenAI strict
// json_schema rejects schemas without it, Anthropic strict tool_use requires
// it, and Google supports it natively (Nov 2025).
//
// Optional fields (`content`, `noChangeReason`) are typed as `["string",
// "null"]` and listed in `required` because OpenAI strict mode does not
// support truly optional fields — the model must always emit the key, but
// can return null when not applicable.
export function suggestedProfileJsonSchema() {
  return {
    type: 'object',
    required: ['changes', 'noteChanges', 'noChangeReason'],
    additionalProperties: false,
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'rationale', 'edit'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            rationale: { type: 'string' },
            edit: {
              type: 'object',
              required: ['type', 'anchor', 'content'],
              additionalProperties: false,
              properties: {
                type: { type: 'string', enum: ['replace', 'insert', 'delete'] },
                anchor: { type: 'string' },
                content: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
      noteChanges: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'rationale', 'action', 'noteId', 'scope', 'text'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            rationale: { type: 'string' },
            action: { type: 'string', enum: ['add', 'revise', 'retire'] },
            noteId: { type: ['string', 'null'] },
            scope: { type: ['string', 'null'] },
            text: { type: ['string', 'null'] },
          },
        },
      },
      noChangeReason: { type: ['string', 'null'] },
    },
  };
}

// Keep the note changes that can apply to the reader's notes: a revise or
// retire must name an existing note, an add needs a scope with room. The
// rest are dropped rather than failing the whole suggestion.
export function validateNoteChanges(noteChanges, notes) {
  const ids = new Set(notes.map((n) => n.id));
  const counts = Object.fromEntries(
    NOTE_SCOPES.map((s) => [s, notes.filter((n) => n.scope === s).length])
  );
  const kept = [];
  let dropped = 0;
  for (const c of noteChanges ?? []) {
    const text = typeof c.text === 'string' ? c.text.trim() : '';
    let ok = false;
    if (c.action === 'add') {
      ok = NOTE_SCOPES.includes(c.scope) && text !== '' && counts[c.scope] < MAX_NOTES_PER_SCOPE;
      if (ok) counts[c.scope] += 1;
    } else if (c.action === 'revise') {
      ok = ids.has(c.noteId) && text !== '';
    } else if (c.action === 'retire') {
      ok = ids.has(c.noteId);
    }
    if (ok) kept.push({ ...c, text: c.action === 'retire' ? null : text });
    else dropped += 1;
  }
  return { kept, dropped };
}

// Hint appended to the prompt on overlap retry. Kept as a module-level constant
// so integration tests can construct the same retry prompt to seed fixtures.
export const OVERLAP_RETRY_HINT =
  '\n\nYour previous response had overlapping or unanchored changes. Produce strictly non-overlapping atomic changes whose anchors appear verbatim in the current profile.';

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
    'Please emit a corrected suggestion that (a) conforms to the schema {changes: [{id, rationale, edit: {type, anchor, content}}], noteChanges: [{id, rationale, action, noteId, scope, text}], noChangeReason?: string}, (b) preserves the original intent and content as much as possible while fixing the errors, (c) does not invent new feedback events. Respond with the corrected structured suggestion.',
  ].join('\n');
}

function formatValidationDetails(details) {
  const parts = [];
  if (details.missingAnchors?.length) {
    parts.push(`missingAnchors=[${details.missingAnchors.join(', ')}]`);
  }
  if (details.overlappingIds?.length) {
    parts.push(`overlappingIds=[${details.overlappingIds.join(', ')}]`);
  }
  return parts.join(' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const {
    currentProfile,
    currentNotes,
    feedback,
    briefings,
    guidance,
    briefingModel,
    provider,
    apiKey: clientApiKey,
    password,
    callModelMode,
  } = req.body ?? {};

  // Phase 1: password gate before the body-field 400 so a wrong password is
  // always a 401, matching this route's original check ordering.
  const gate = checkRoutePassword({ apiKey: clientApiKey, password });
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

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

  // Phase 2: env-key resolution + callMode + fixture-aware credential check
  // (fixture mode skips the missing-credentials 401; see resolveRouteAuth).
  const auth = resolveRouteAuth({
    apiKey: clientApiKey,
    password,
    provider,
    callModelMode,
    messages: { missingCredentials: 'missing apiKey or password' },
  });
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const { apiKey, callMode } = auth;

  // Resolve briefingModel (user-facing ID) → apiId. If briefingModel is already
  // an apiId or unknown, fall through to using the provided value directly so
  // tests can pass apiIds directly.
  const registryEntry = MODEL_REGISTRY[briefingModel];
  const modelApiId = registryEntry?.apiId ?? briefingModel;

  try {
    // Load the suggest-profile prompt template
    const templatePath = path.resolve(process.cwd(), 'prompts', 'suggest-profile.md');
    const template = await fs.readFile(templatePath, 'utf8');
    const notes = normalizeNotes(currentNotes);
    const fullPrompt = renderSuggestPrompt(template, {
      profile: currentProfile,
      notes,
      events: feedback,
      briefings: briefings ?? {},
      guidance: typeof guidance === 'string' ? guidance : '',
    });

    // The stable cache prefix is the template text before {{profile}} (the static
    // instructions). The variable tail is the rendered profile + feedback content.
    const profileSlotIdx = template.indexOf('{{profile}}');
    const cachePrefix = profileSlotIdx >= 0 ? template.slice(0, profileSlotIdx) : '';

    // APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE replaces the full prompt for fixture-based
    // tests. When active (or when running in fixture mode), disable caching so the
    // fixture hash keys only on {provider, model, prompt, apiKey} — a stable value.
    const promptOverride = process.env.APARTURE_TEST_SUGGEST_PROMPT_OVERRIDE;
    const isFixture = callMode.mode === 'fixture';
    // When user guidance is present, renderSuggestPrompt prepends a guidance
    // block ahead of the template prefix, so cachePrefix is no longer a true
    // prefix of fullPrompt — caching must be disabled or the slice below would
    // corrupt the prompt (cachePrefix + tail !== fullRenderedPrompt).
    const useCaching =
      provider === 'anthropic' &&
      !promptOverride &&
      !isFixture &&
      fullPrompt.startsWith(cachePrefix);
    const finalPrompt = promptOverride ?? fullPrompt;
    const variableTail = useCaching ? fullPrompt.slice(cachePrefix.length) : finalPrompt;

    const jsonSchema = suggestedProfileJsonSchema();
    const structuredOutput = {
      name: 'suggested_profile',
      description: 'Aparture suggested research profile revision',
      schema: jsonSchema,
    };

    // First call
    const response = await callModel(
      {
        provider,
        model: modelApiId,
        prompt: useCaching ? variableTail : finalPrompt,
        apiKey,
        structuredOutput,
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

    // Schema validation (first pass)
    const firstCheck = SuggestedProfileSchema.safeParse(response.structured);
    let data;
    let totalTokensIn = response.tokensIn;
    let totalTokensOut = response.tokensOut;
    let repaired = false;
    let firstErrors = null;

    if (firstCheck.success) {
      data = firstCheck.data;
    } else {
      // Two-pass schema repair
      firstErrors = firstCheck.error.issues.map((i) => `schema: ${i.path.join('.')} ${i.message}`);
      const repairPrompt = buildRepairPrompt({
        originalSuggestion: response.structured,
        errors: firstErrors,
      });
      const repairedResp = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: repairPrompt,
          apiKey,
          structuredOutput,
        },
        callMode
      );
      if (!repairedResp?.structured) {
        res.status(500).json({
          error: 'repair callModel returned no structured output',
          originalValidationErrors: firstErrors,
        });
        return;
      }
      const secondCheck = SuggestedProfileSchema.safeParse(repairedResp.structured);
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
      data = secondCheck.data;
      totalTokensIn += repairedResp.tokensIn ?? 0;
      totalTokensOut += repairedResp.tokensOut ?? 0;
      repaired = true;
    }

    // Non-overlap validation (if empty changes, skip — no edits to validate)
    const overlapCheck =
      data.changes.length === 0
        ? { ok: true }
        : validateNonOverlappingChanges(data.changes, currentProfile);

    if (!overlapCheck.ok) {
      // Retry once with an overlap-specific hint appended to the prompt.
      const retryPromptRendered = fullPrompt + OVERLAP_RETRY_HINT;
      const retryFinalPrompt = promptOverride
        ? promptOverride + OVERLAP_RETRY_HINT
        : retryPromptRendered;
      // Caching disabled on retry: the appended hint changes every run and
      // there is no benefit in paying for a rare-path cache write.
      const retryResponse = await callModel(
        {
          provider,
          model: modelApiId,
          prompt: retryFinalPrompt,
          apiKey,
          structuredOutput,
        },
        callMode
      );

      if (!retryResponse?.structured) {
        res.status(422).json({
          error: 'CHANGES_OVERLAP_UNRESOLVABLE',
          details: overlapCheck,
          retryError: 'retry callModel returned no structured output',
        });
        return;
      }

      const retryCheck = SuggestedProfileSchema.safeParse(retryResponse.structured);
      if (!retryCheck.success) {
        const retryErrors = retryCheck.error.issues.map(
          (i) => `schema: ${i.path.join('.')} ${i.message}`
        );
        res.status(422).json({
          error: 'CHANGES_OVERLAP_UNRESOLVABLE',
          details: overlapCheck,
          retryValidationErrors: retryErrors,
        });
        return;
      }

      const retryData = retryCheck.data;
      const retryOverlap =
        retryData.changes.length === 0
          ? { ok: true }
          : validateNonOverlappingChanges(retryData.changes, currentProfile);

      if (!retryOverlap.ok) {
        res.status(422).json({
          error: 'CHANGES_OVERLAP_UNRESOLVABLE',
          details: retryOverlap,
          firstAttempt: {
            overlap: overlapCheck,
            summary: formatValidationDetails(overlapCheck),
          },
        });
        return;
      }

      const retryNotes = validateNoteChanges(retryData.noteChanges, notes);
      res.status(200).json({
        changes: retryData.changes,
        noteChanges: retryNotes.kept,
        ...(retryNotes.dropped ? { droppedNoteChanges: retryNotes.dropped } : {}),
        noChangeReason: retryData.noChangeReason,
        tokensIn: totalTokensIn + (retryResponse.tokensIn ?? 0),
        tokensOut: totalTokensOut + (retryResponse.tokensOut ?? 0),
        repaired,
        retried: true,
        ...(firstErrors ? { originalValidationErrors: firstErrors } : {}),
      });
      return;
    }

    // First response (possibly repaired) passed both schema and overlap checks.
    const checkedNotes = validateNoteChanges(data.noteChanges, notes);
    res.status(200).json({
      changes: data.changes,
      noteChanges: checkedNotes.kept,
      ...(checkedNotes.dropped ? { droppedNoteChanges: checkedNotes.dropped } : {}),
      noChangeReason: data.noChangeReason,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      repaired,
      retried: false,
      ...(firstErrors ? { originalValidationErrors: firstErrors } : {}),
    });
  } catch (err) {
    if (sendRefusalErrorResponse(res, err)) return;
    if (sendProviderErrorResponse(res, err)) return;
    res.status(500).json({ error: 'suggest-profile failed', details: String(err?.message ?? err) });
  }
}
