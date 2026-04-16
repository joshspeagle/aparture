import { BriefingSchema } from './schema.js';

// Run zod schema validation first; if that passes, run citation validation.
export function validateBriefing(briefing, inputPaperIds) {
  const schemaResult = BriefingSchema.safeParse(briefing);
  if (!schemaResult.success) {
    return {
      ok: false,
      errors: schemaResult.error.issues.map((i) => `schema: ${i.path.join('.')} ${i.message}`),
    };
  }
  return validateCitations(schemaResult.data, inputPaperIds);
}

export function validateCitations(briefing, inputPaperIds) {
  const errors = [];
  const allowed = new Set(inputPaperIds);

  // PaperCard.arxivId
  for (const paper of briefing.papers ?? []) {
    if (!allowed.has(paper.arxivId)) {
      errors.push(`paperCard references unknown arxivId "${paper.arxivId}" (not in input list)`);
    }
  }

  // ThemeSection.paperIds
  for (const theme of briefing.themes ?? []) {
    for (const id of theme.paperIds ?? []) {
      if (!allowed.has(id)) {
        errors.push(`theme "${theme.title ?? '(untitled)'}" references unknown arxivId "${id}"`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
