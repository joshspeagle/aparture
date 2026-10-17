// The reader's notes for one briefing: free text written at the pre-briefing
// review (Gate 3), whose placeholder invites "Lead with the diffusion-models
// cluster." /api/synthesize appends them to the prompt as editorial
// instructions. prompts/synthesis.md has no slot for them, so the section is
// rendered here and appended after the full prompt, like the retry hint;
// the cache prefix (template + profile) is unaffected.

export const MAX_READER_NOTES = 5;
export const MAX_READER_NOTE_CHARS = 1000;

export function normalizeReaderNotes(notes) {
  const list = Array.isArray(notes) ? notes : typeof notes === 'string' ? [notes] : [];
  return list
    .filter((n) => typeof n === 'string')
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(-MAX_READER_NOTES)
    .map((n) => (n.length > MAX_READER_NOTE_CHARS ? `${n.slice(0, MAX_READER_NOTE_CHARS)}…` : n));
}

export function renderReaderNotesSection(notes) {
  const clean = normalizeReaderNotes(notes);
  if (clean.length === 0) return '';
  return [
    '',
    '',
    "# The reader's notes for this briefing",
    '',
    "At the pre-briefing review the reader left the notes below for today's briefing. Treat them as editorial instructions: what to lead with, what to emphasize, how to frame the day. They do not override the hard constraints or the sourcing discipline above, and they are not evidence about any paper's content.",
    '',
    ...clean.map((n) => `- "${n}"`),
  ].join('\n');
}
