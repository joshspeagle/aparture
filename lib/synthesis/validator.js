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

  // DebateBlock.paperIds
  for (const debate of briefing.debates ?? []) {
    for (const id of debate.paperIds ?? []) {
      if (!allowed.has(id)) {
        errors.push(`debate "${debate.title ?? '(untitled)'}" references unknown arxivId "${id}"`);
      }
    }
  }

  // LongitudinalConnection.todayPaperId (pastPaperId is allowed to be anything since past papers may not be in today's input)
  for (const conn of briefing.longitudinal ?? []) {
    if (conn.todayPaperId && !allowed.has(conn.todayPaperId)) {
      errors.push(`longitudinal connection references unknown todayPaperId "${conn.todayPaperId}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
