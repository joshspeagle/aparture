// Editorial notes: short lines about the reader's taste, learned from their
// feedback, kept beside the research profile rather than inside it. The
// profile stays in the reader's own words and says what they work on; a note
// says how the editor should judge or write ("Benchmark-only papers count as
// adjacent", "Lead with the result, then the method").
//
// Each note has a scope that decides which prompts see it, so a note about
// writing never shifts a score. Code places the notes, right after the
// research profile, under a line saying the profile wins where they
// conflict. The skill keeps the same notes in learned.md, one section per
// scope (renderLearnedMarkdown / parseLearnedMarkdown).

export const NOTE_SCOPES = ['selection', 'writing', 'podcast'];

export const NOTE_SCOPE_INFO = {
  selection: {
    label: 'Selection',
    help: 'What makes the cut and how it scores: the filter, abstract scoring, and the PDF read.',
  },
  writing: {
    label: 'Writing',
    help: "How the briefing is written and ordered: synthesis and the editor's questions.",
  },
  podcast: {
    label: 'Podcast',
    help: 'How the episode should sound: added to the focus prompt you paste.',
  },
};

// Enough for a reader's real preferences without crowding out the profile;
// at the cap a proposal has to merge or retire a note instead of adding one.
export const MAX_NOTES_PER_SCOPE = 12;
export const MAX_NOTE_CHARS = 280;

export const NOTES_HEADING =
  "Editorial notes, learned from the reader's feedback (where a note conflicts with the research profile, the profile wins):";

const SOURCES = new Set(['manual', 'suggested', 'answer']);

function cleanText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_CHARS) : '';
}

export function newNoteId(now = Date.now()) {
  return `n${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Drop malformed entries; keep known fields only. Never throws. */
export function normalizeNotes(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const n of raw) {
    const text = cleanText(n?.text);
    if (!text || !NOTE_SCOPES.includes(n?.scope)) continue;
    const id = typeof n.id === 'string' && n.id && !seen.has(n.id) ? n.id : newNoteId();
    seen.add(id);
    out.push({
      id,
      text,
      scope: n.scope,
      source: SOURCES.has(n.source) ? n.source : 'manual',
      createdAt: Number.isFinite(n.createdAt) ? n.createdAt : 0,
      ...(Number.isFinite(n.editedAt) ? { editedAt: n.editedAt } : {}),
      ...(typeof n.rationale === 'string' && n.rationale ? { rationale: n.rationale } : {}),
    });
  }
  return out;
}

export function notesForScope(notes, scope) {
  return (notes ?? []).filter((n) => n.scope === scope);
}

/** True when a scope has room for another note. */
export function hasRoom(notes, scope) {
  return notesForScope(notes, scope).length < MAX_NOTES_PER_SCOPE;
}

/** The block that follows the research profile in a prompt; '' when empty. */
export function renderNotesBlock(notes, scope) {
  const lines = notesForScope(notes, scope).map((n) => `- ${n.text}`);
  return lines.length ? `${NOTES_HEADING}\n${lines.join('\n')}` : '';
}

/**
 * The profile text a prompt receives: the research profile, then the
 * scope's notes. Byte-identical to the profile when there are none.
 */
export function profileWithNotes(content, notes, scope) {
  const block = renderNotesBlock(notes, scope);
  const text = content ?? '';
  return block ? `${text.replace(/\s+$/, '')}\n\n${block}` : text;
}

/**
 * Apply accepted note changes from a suggestion. Each change is
 * {action: 'add'|'revise'|'retire', noteId, scope, text, rationale}.
 * Unknown ids, bad scopes and adds past a scope's cap are skipped.
 */
export function applyNoteChanges(notes, changes, now = Date.now()) {
  let next = [...(notes ?? [])];
  for (const c of changes ?? []) {
    if (c?.action === 'add') {
      const text = cleanText(c.text);
      if (!text || !NOTE_SCOPES.includes(c.scope) || !hasRoom(next, c.scope)) continue;
      next.push({
        id: newNoteId(now),
        text,
        scope: c.scope,
        source: 'suggested',
        createdAt: now,
        ...(c.rationale ? { rationale: c.rationale } : {}),
      });
    } else if (c?.action === 'revise') {
      const text = cleanText(c.text);
      if (!text) continue;
      next = next.map((n) =>
        n.id === c.noteId
          ? { ...n, text, editedAt: now, ...(c.rationale ? { rationale: c.rationale } : {}) }
          : n
      );
    } else if (c?.action === 'retire') {
      next = next.filter((n) => n.id !== c.noteId);
    }
  }
  return next;
}

/** The notes as the suggest prompt sees them: ids, so it can revise or retire. */
export function renderNotesForSuggest(notes) {
  if (!notes?.length) return '(none yet)';
  return NOTE_SCOPES.map((scope) => {
    const items = notesForScope(notes, scope);
    const body = items.length ? items.map((n) => `- [${n.id}] ${n.text}`).join('\n') : '(none)';
    return `${NOTE_SCOPE_INFO[scope].label} (${items.length}/${MAX_NOTES_PER_SCOPE}):\n${body}`;
  }).join('\n\n');
}

// --- learned.md (the skill's copy) -----------------------------------------

/** One section per scope, one note per bullet. */
export function renderLearnedMarkdown(notes) {
  const sections = NOTE_SCOPES.map((scope) => {
    const items = notesForScope(notes, scope);
    const body = items.length ? items.map((n) => `- ${n.text}`).join('\n') : '';
    return `## ${NOTE_SCOPE_INFO[scope].label}\n\n${body}`.trimEnd();
  });
  return `# Editorial notes\n\n${sections.join('\n\n')}\n`;
}

/**
 * Read learned.md back into notes. Bullets under an unknown heading, or
 * before any heading, count as selection notes: older learned.md files had
 * no sections, and taste about papers was what they held.
 */
export function parseLearnedMarkdown(md) {
  const byLabel = Object.fromEntries(
    NOTE_SCOPES.map((s) => [NOTE_SCOPE_INFO[s].label.toLowerCase(), s])
  );
  let scope = 'selection';
  const notes = [];
  for (const line of String(md ?? '').split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      scope = byLabel[heading[1].toLowerCase()] ?? 'selection';
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) notes.push({ text: bullet[1], scope, source: 'manual', createdAt: 0 });
  }
  return normalizeNotes(notes);
}
