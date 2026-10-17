import {
  missingInputPapers,
  normalizeBriefing,
  toInputPapers,
  validateBriefing,
} from './validator.js';
import { toJsonSchema } from './schema.js';

// One-shot LLM repair of a briefing that failed validateBriefing.
//
// `inputPapers` is the list the briefing was synthesized from (paper objects
// as sent to /api/synthesize); legacy callers may still pass bare ids as
// `inputPaperIds`. Both passes are normalized first (titles/scores from the
// input, duplicates dropped — see validator.js), so only problems code can't
// fix reach the model.
//
// On a repair that still fails validation this throws `repair failed: …`
// with the normalized candidate, its errors and the repair call's token
// usage attached (`err.briefing`, `err.validationErrors`, `err.tokensIn`,
// `err.tokensOut`), so the route can salvage it deterministically instead of
// discarding the whole briefing.
export async function repairBriefing({
  briefing,
  inputPapers,
  inputPaperIds,
  callModel,
  llmConfig,
}) {
  const input = inputPapers ?? inputPaperIds ?? [];
  const first = normalizeBriefing(briefing, input);
  const firstCheck = validateBriefing(first.briefing, input);
  if (firstCheck.ok) {
    return {
      briefing: first.briefing,
      repaired: false,
      corrections: first.corrections,
      tokensIn: 0,
      tokensOut: 0,
    };
  }

  if (!callModel || !llmConfig) {
    throw new Error(
      `briefing validation failed and no repair callModel provided: ${firstCheck.errors.join('; ')}`
    );
  }

  const repairPrompt = buildRepairPrompt({
    originalBriefing: first.briefing,
    input,
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
    const err = new Error('repair callModel returned no structured output');
    err.tokensIn = repaired?.tokensIn ?? 0;
    err.tokensOut = repaired?.tokensOut ?? 0;
    throw err;
  }

  const second = normalizeBriefing(repaired.structured, input);
  const secondCheck = validateBriefing(second.briefing, input);
  const corrections = [...first.corrections, ...second.corrections];
  if (!secondCheck.ok) {
    const err = new Error(`repair failed: ${secondCheck.errors.join('; ')}`);
    err.briefing = second.briefing;
    err.validationErrors = secondCheck.errors;
    err.corrections = corrections;
    err.tokensIn = repaired.tokensIn ?? 0;
    err.tokensOut = repaired.tokensOut ?? 0;
    throw err;
  }

  return {
    briefing: second.briefing,
    repaired: true,
    corrections,
    tokensIn: repaired.tokensIn ?? 0,
    tokensOut: repaired.tokensOut ?? 0,
  };
}

const oneLine = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

function formatPaperLine(p) {
  const title = p.title ? ` — "${oneLine(p.title)}"` : '';
  const flags = `${p.starred ? ' [starred]' : ''}${p.dismissed ? ' [dismissed]' : ''}`;
  return `- ${p.arxivId}${title}${flags}`;
}

// The model is shown each id's title (so a bad id can't be "fixed" onto the
// wrong paper) and, for every paper that still needs a card, that paper's
// own source material (so a new card is grounded rather than invented).
function buildRepairPrompt({ originalBriefing, input, errors }) {
  const papers = toInputPapers(input);
  const missing = missingInputPapers(originalBriefing, input);
  const lines = [
    'You previously emitted a briefing that failed validation. Here is the original briefing:',
    '```json',
    JSON.stringify(originalBriefing, null, 2),
    '```',
    '',
    "Today's input papers. These are the only arxivIds you may reference anywhere in the briefing, including in prose:",
    papers.map(formatPaperLine).join('\n'),
    '',
    'The following validation errors were detected:',
    errors.map((e) => `- ${e}`).join('\n'),
  ];

  if (missing.length > 0) {
    lines.push(
      '',
      'Source material for the papers that still need a card (ground any new card in this material only):'
    );
    for (const p of missing) {
      lines.push('', `### ${p.arxivId}${p.title ? ` — ${oneLine(p.title)}` : ''}`);
      if (p.abstract) lines.push(`Abstract: ${p.abstract}`);
      if (p.scoringJustification) lines.push(`Scoring note: ${p.scoringJustification}`);
      if (p.fullReport) lines.push(`Full report:\n${p.fullReport}`);
    }
  }

  lines.push(
    '',
    'Please emit a corrected briefing that:',
    '(a) has exactly one card in `papers` for every input paper (papers marked [dismissed] may be left out), with no duplicates, and a card for every [starred] paper;',
    '(b) places every card in at least one theme;',
    '(c) references only arxivIds from the list above — in `papers`, in `themes.paperIds`, and in all prose (the executive summary, theme titles and arguments, pitches and whyMatters);',
    '(d) preserves the original structure and content as much as possible while fixing the errors, and does not invent new papers or claims.',
    'Respond with the corrected structured briefing.'
  );
  return lines.join('\n');
}
