import { validateBriefing } from './validator.js';
import { toJsonSchema } from './schema.js';

export async function repairBriefing({ briefing, inputPaperIds, callModel, llmConfig }) {
  const firstCheck = validateBriefing(briefing, inputPaperIds);
  if (firstCheck.ok) {
    return { briefing, repaired: false };
  }

  if (!callModel || !llmConfig) {
    throw new Error(
      `briefing validation failed and no repair callModel provided: ${firstCheck.errors.join('; ')}`
    );
  }

  const repairPrompt = buildRepairPrompt({
    originalBriefing: briefing,
    inputPaperIds,
    errors: firstCheck.errors,
  });

  const repaired = await callModel({
    ...llmConfig,
    prompt: repairPrompt,
    structuredOutput: {
      name: 'briefing',
      description: 'Aparture daily research briefing',
      schema: toJsonSchema(),
    },
  });

  if (!repaired?.structured) {
    throw new Error('repair callModel returned no structured output');
  }

  const secondCheck = validateBriefing(repaired.structured, inputPaperIds);
  if (!secondCheck.ok) {
    throw new Error(`repair failed: ${secondCheck.errors.join('; ')}`);
  }

  return { briefing: repaired.structured, repaired: true };
}

function buildRepairPrompt({ originalBriefing, inputPaperIds, errors }) {
  return [
    'You previously emitted a briefing that failed validation. Here is the original briefing:',
    '```json',
    JSON.stringify(originalBriefing, null, 2),
    '```',
    '',
    "The allowed set of arxivIds for today's run is:",
    inputPaperIds.map((id) => `- ${id}`).join('\n'),
    '',
    'The following validation errors were detected:',
    errors.map((e) => `- ${e}`).join('\n'),
    '',
    'Please emit a corrected briefing that (a) references only arxivIds from the allowed list, (b) preserves the original structure and content as much as possible while fixing the errors, (c) does not invent new papers. Respond with the corrected structured briefing.',
  ].join('\n');
}
