import { BriefingSchema } from './schema.js';

// Deterministic trust checks for a synthesized briefing. Three layers, all
// pure and free (no LLM call):
//
//   normalizeBriefing — CORRECTS what code already knows: each card's title
//     and score are overwritten from the input paper (the model only copies
//     them, and a valid id carrying another paper's title renders as fact),
//     and duplicate cards / duplicate theme entries are dropped. Corrections
//     are reported, never failed.
//   validateBriefing  — REJECTS what code can't fix by itself: unknown ids
//     (cards, themes, and arXiv-id-shaped tokens in prose), input papers with
//     no card (starred ones called out), duplicate cards, and cards in no
//     theme (which the view would never render). Failures go to the LLM
//     repair (lib/synthesis/repair.js).
//   salvageBriefing   — last resort when repair fails: strips what is
//     fabricated and fills what is missing with clearly-labelled, code-written
//     content, so a near-miss never costs the user the whole briefing.
//
// `input` is the list the briefing was synthesized from: paper objects
// ({arxivId, title, score, engagement, ...}, as sent to /api/synthesize) or
// bare arxivId strings (legacy callers; title/score/starred checks need the
// objects and are skipped for strings).

// arXiv identifiers as they appear in prose: new-style YYMM.NNNNN (2015 on)
// and old-style YYMM.NNNN (2007-04 .. 2014-12), with an optional "arXiv:"
// prefix and version suffix. The YYMM part is range-checked so decimals such
// as "1420.4058 MHz" or "2132.17" don't read as ids.
const ARXIV_ID_IN_PROSE =
  /\b(?:arXiv:\s*)?((?:1[5-9]|[2-9]\d)(?:0[1-9]|1[0-2])\.\d{5}|(?:0[7-9]|1[0-4])(?:0[1-9]|1[0-2])\.\d{4})(?:v\d+)?\b/gi;

export const UNVERIFIED_ID_PLACEHOLDER = '[unverified arXiv ID removed]';

export const OTHER_PAPERS_THEME = Object.freeze({
  title: "Other papers in today's final round",
  argument:
    'The briefing model did not place these papers in a theme. Aparture lists them here so that no paper in today’s set is silently dropped.',
});

const stripVersion = (id) => String(id ?? '').replace(/v\d+$/, '');

// Idempotent: accepts raw input papers ({engagement: {starred}}) or the
// already-flattened shape this returns ({starred}).
function toInputPapers(input) {
  return (Array.isArray(input) ? input : []).map((p) =>
    typeof p === 'string'
      ? { arxivId: p }
      : {
          arxivId: p?.arxivId ?? p?.id,
          title: p?.title,
          score: p?.score,
          starred: p?.starred === true || p?.engagement?.starred === true,
          dismissed: p?.dismissed === true || p?.engagement?.dismissed === true,
          abstract: p?.abstract,
          scoringJustification: p?.scoringJustification,
          fullReport: p?.fullReport,
        }
  );
}

// Every prose field a reader sees, with a label for error messages.
function proseFields(briefing) {
  const fields = [['executiveSummary', briefing?.executiveSummary]];
  (briefing?.themes ?? []).forEach((t, i) => {
    fields.push([`themes[${i}].title`, t?.title]);
    fields.push([`themes[${i}].argument`, t?.argument]);
  });
  (briefing?.papers ?? []).forEach((p) => {
    fields.push([`papers[${p?.arxivId}].onelinePitch`, p?.onelinePitch]);
    fields.push([`papers[${p?.arxivId}].whyMatters`, p?.whyMatters]);
  });
  return fields.filter(([, text]) => typeof text === 'string' && text.length > 0);
}

const collapseWhitespace = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

// Run zod schema validation first; if that passes, run the citation,
// coverage and prose-id checks. Returns exactly { ok, errors }.
export function validateBriefing(briefing, input) {
  const schemaResult = BriefingSchema.safeParse(briefing);
  if (!schemaResult.success) {
    return {
      ok: false,
      errors: schemaResult.error.issues.map((i) => `schema: ${i.path.join('.')} ${i.message}`),
    };
  }
  const papers = toInputPapers(input);
  const ids = papers.map((p) => p.arxivId);
  const errors = [
    ...validateCitations(schemaResult.data, ids).errors,
    ...validateCoverage(schemaResult.data, papers).errors,
    ...validateProseIds(schemaResult.data, ids).errors,
  ];
  return { ok: errors.length === 0, errors };
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

// Every input paper gets exactly one card (dismissed papers may be omitted —
// the synthesis prompt lets the model leave them out), starred papers are
// always featured, and every card sits in at least one theme. Unknown ids are
// validateCitations' job and are not double-reported here.
export function validateCoverage(briefing, input) {
  const papers = toInputPapers(input);
  const allowed = new Set(papers.map((p) => p.arxivId));
  const errors = [];

  const cardCounts = new Map();
  for (const card of briefing.papers ?? []) {
    cardCounts.set(card.arxivId, (cardCounts.get(card.arxivId) ?? 0) + 1);
  }
  for (const [id, count] of cardCounts) {
    if (count > 1 && allowed.has(id)) {
      errors.push(`paper "${id}" has ${count} cards in papers (expected exactly one)`);
    }
  }

  const reportedMissing = new Set();
  for (const p of papers) {
    if (cardCounts.has(p.arxivId)) continue;
    if (p.starred) {
      errors.push(
        `starred paper "${p.arxivId}" has no card in papers (every starred paper must be featured)`
      );
      reportedMissing.add(p.arxivId);
    } else if (!p.dismissed) {
      errors.push(
        `input paper "${p.arxivId}" has no card in papers (every final-round paper needs exactly one)`
      );
      reportedMissing.add(p.arxivId);
    }
  }

  const themed = new Set();
  for (const theme of briefing.themes ?? []) {
    for (const id of theme.paperIds ?? []) {
      themed.add(id);
      // A theme entry with no card renders nothing. Missing cards are
      // already reported above; this catches the dismissed-and-omitted case.
      if (allowed.has(id) && !cardCounts.has(id) && !reportedMissing.has(id)) {
        errors.push(`theme "${theme.title ?? '(untitled)'}" lists "${id}", which has no card`);
      }
    }
  }
  for (const id of cardCounts.keys()) {
    if (allowed.has(id) && !themed.has(id)) {
      errors.push(`paper "${id}" is not in any theme (its card would never be shown)`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// Any arXiv-id-shaped token in reader-visible prose must be one of today's
// papers — the prompt asks for "make it [arxivId]", and nothing else checked
// that the id it got was real.
export function validateProseIds(briefing, inputPaperIds) {
  const allowed = new Set((inputPaperIds ?? []).map(stripVersion));
  const errors = [];
  for (const [field, text] of proseFields(briefing)) {
    const seen = new Set();
    for (const match of text.matchAll(ARXIV_ID_IN_PROSE)) {
      const id = match[1];
      if (allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      errors.push(`${field} mentions arXiv id "${id}", which is not in today's input`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// Deterministic corrections, applied before validation. Never fails; returns
// a new briefing (the input is not mutated) plus a list of what changed.
export function normalizeBriefing(briefing, input) {
  if (!briefing || typeof briefing !== 'object' || Array.isArray(briefing)) {
    return { briefing, corrections: [] };
  }
  const byId = new Map(
    toInputPapers(input)
      .filter((p) => p.arxivId)
      .map((p) => [p.arxivId, p])
  );
  const corrections = [];
  const out = { ...briefing };

  if (Array.isArray(briefing.papers)) {
    const seen = new Set();
    out.papers = [];
    for (const card of briefing.papers) {
      if (!card || typeof card !== 'object' || typeof card.arxivId !== 'string') {
        out.papers.push(card); // malformed: leave it for the schema check
        continue;
      }
      if (seen.has(card.arxivId)) {
        corrections.push(`dropped a duplicate card for "${card.arxivId}"`);
        continue;
      }
      seen.add(card.arxivId);
      const source = byId.get(card.arxivId);
      let next = card;
      if (typeof source?.title === 'string' && source.title.trim()) {
        if (collapseWhitespace(card.title) !== collapseWhitespace(source.title)) {
          corrections.push(
            `card "${card.arxivId}": title "${card.title ?? ''}" replaced with the paper's title "${collapseWhitespace(source.title)}"`
          );
        }
        if (card.title !== source.title) next = { ...next, title: source.title };
      }
      if (typeof source?.score === 'number' && Number.isFinite(source.score)) {
        if (card.score !== source.score) {
          corrections.push(
            `card "${card.arxivId}": score ${card.score} replaced with the pipeline score ${source.score}`
          );
          next = { ...next, score: source.score };
        }
      }
      out.papers.push(next);
    }
  }

  if (Array.isArray(briefing.themes)) {
    out.themes = briefing.themes.map((theme) => {
      if (!theme || typeof theme !== 'object' || !Array.isArray(theme.paperIds)) return theme;
      const unique = [...new Set(theme.paperIds)];
      if (unique.length === theme.paperIds.length) return theme;
      corrections.push(`theme "${theme.title ?? '(untitled)'}": dropped duplicate paper ids`);
      return { ...theme, paperIds: unique };
    });
  }

  return { briefing: out, corrections };
}

// Last-resort deterministic repair for a SCHEMA-VALID briefing that still
// fails validation after the LLM repair: strip what is fabricated, fill what
// is missing with labelled code-written content. Returns the new briefing
// and a list of the actions taken (empty when nothing needed doing).
export function salvageBriefing(briefing, input) {
  const papers = toInputPapers(input);
  const byId = new Map(papers.map((p) => [p.arxivId, p]));
  const actions = [];

  // 1. Cards: drop unknown ids (fabricated), then add a labelled card for
  //    every non-dismissed input paper the model left out.
  const cards = [];
  for (const card of briefing.papers ?? []) {
    if (!byId.has(card.arxivId)) {
      actions.push(`removed the card for unknown arxivId "${card.arxivId}"`);
      continue;
    }
    cards.push(card);
  }
  const carded = new Set(cards.map((c) => c.arxivId));
  for (const p of papers) {
    if (carded.has(p.arxivId) || p.dismissed) continue;
    if (typeof p.title !== 'string' || !p.title.trim()) continue; // nothing to show
    cards.push({
      arxivId: p.arxivId,
      title: p.title,
      score: typeof p.score === 'number' && p.score >= 0 && p.score <= 10 ? p.score : 0,
      onelinePitch: 'Added by Aparture: the briefing model left this paper out.',
      whyMatters:
        'This paper was in today’s final round, but the briefing model did not write a card for it, so Aparture added this one instead of dropping it. Open the full report for the pipeline’s analysis.',
    });
    carded.add(p.arxivId);
    actions.push(`added a placeholder card for "${p.arxivId}"${p.starred ? ' (starred)' : ''}`);
  }

  // 2. Themes: keep only ids that have a card; drop themes left empty.
  const themes = [];
  for (const theme of briefing.themes ?? []) {
    const kept = theme.paperIds.filter((id) => carded.has(id));
    if (kept.length !== theme.paperIds.length) {
      actions.push(`theme "${theme.title}": removed ids without a card`);
    }
    if (kept.length === 0) {
      actions.push(`removed theme "${theme.title}" (no papers left)`);
      continue;
    }
    themes.push(kept.length === theme.paperIds.length ? theme : { ...theme, paperIds: kept });
  }

  // 3. Orphans: every card must be reachable from a theme.
  const themed = new Set(themes.flatMap((t) => t.paperIds));
  const orphans = cards.map((c) => c.arxivId).filter((id) => !themed.has(id));
  if (orphans.length > 0) {
    themes.push({ ...OTHER_PAPERS_THEME, paperIds: orphans });
    actions.push(`grouped ${orphans.length} unthemed paper(s) under "${OTHER_PAPERS_THEME.title}"`);
  }

  // 4. Prose: neutralize arXiv ids that aren't today's papers.
  const allowed = new Set(papers.map((p) => stripVersion(p.arxivId)));
  const scrub = (text, field) => {
    if (typeof text !== 'string') return text;
    return text.replace(ARXIV_ID_IN_PROSE, (match, id) => {
      if (allowed.has(id)) return match;
      actions.push(`${field}: removed unknown arXiv id "${id}"`);
      return UNVERIFIED_ID_PLACEHOLDER;
    });
  };

  return {
    briefing: {
      ...briefing,
      executiveSummary: scrub(briefing.executiveSummary, 'executiveSummary'),
      themes: themes.map((t, i) => ({
        ...t,
        title: scrub(t.title, `themes[${i}].title`),
        argument: scrub(t.argument, `themes[${i}].argument`),
      })),
      papers: cards.map((c) => ({
        ...c,
        onelinePitch: scrub(c.onelinePitch, `papers[${c.arxivId}].onelinePitch`),
        whyMatters: scrub(c.whyMatters, `papers[${c.arxivId}].whyMatters`),
      })),
    },
    actions,
  };
}

// Exposed for the repair prompt: which inputs need a brand-new card.
export function missingInputPapers(briefing, input) {
  const carded = new Set((briefing?.papers ?? []).map((c) => c?.arxivId));
  return toInputPapers(input).filter((p) => !carded.has(p.arxivId) && !p.dismissed);
}

export { toInputPapers };
