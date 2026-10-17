// Grounding checks for a v2 briefing. Pure: the caller loads the run's
// files and passes them in, so the same checks can run in the headless CLI,
// in tests, or in the web app.
//
// What "checkable" means here, concretely:
//   - every arXiv id the briefing cites came from today's harvest and the
//     right pool (reading set for papers, triaged YES/MAYBE for near misses);
//   - every quoted result appears verbatim in that paper's text;
//   - every figure exists, every proposal anchor exists in its target file;
//   - every "because of your feedback" claim points at feedback that exists.

import { BriefingV2Schema } from './schema.js';

// Quotes are compared with all whitespace removed and typographic variants
// folded: LaTeXML text pads math with spaces (" $P$ , such") and uses curly
// quotes, and a faithful copy shouldn't fail on either. Over 40+ characters
// the chance that removing whitespace creates a false match is negligible.
export function normalizeForQuote(s) {
  return (s ?? '')
    .normalize('NFKC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, '');
}

const MIN_QUOTE_CHARS = 40;

function looseTitle(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\$[^$]*\$/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * @param {unknown} briefing
 * @param {Object} ctx
 * @param {Set<string>} ctx.readIds          the reading set (selection.read)
 * @param {Set<string>} ctx.nearMissPool     ids triaged YES or MAYBE
 * @param {Map<string,string>} ctx.titles    arxivId -> arXiv title
 * @param {Map<string,string>} ctx.paperText arxivId -> full text the reader saw
 * @param {Map<string,Set<string>>} ctx.figureIds arxivId -> figure ids
 * @param {Set<string>} ctx.feedbackRefs     arxivIds and dates present in feedback.jsonl
 * @param {{profile: string, learned: string}} ctx.targets proposal target texts
 * @returns {{ok: boolean, errors: string[], warnings: string[], stats: Object}}
 */
export function validateBriefingV2(briefing, ctx) {
  const errors = [];
  const warnings = [];
  const parsed = BriefingV2Schema.safeParse(briefing);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`schema: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return { ok: false, errors, warnings, stats: {} };
  }
  const b = parsed.data;
  const paperIds = new Set(b.papers.map((p) => p.id));
  let quotesChecked = 0;

  const seen = new Set();
  for (const p of b.papers) {
    const where = `papers[${p.id}]`;
    if (seen.has(p.id)) errors.push(`${where}: listed twice`);
    seen.add(p.id);
    if (!ctx.readIds.has(p.id)) errors.push(`${where}: not in the reading set`);
    const arxivTitle = ctx.titles.get(p.id);
    if (arxivTitle && looseTitle(arxivTitle) !== looseTitle(p.title)) {
      errors.push(`${where}: title differs from arXiv ("${arxivTitle}")`);
    }

    const text = ctx.paperText.get(p.id);
    const quote = normalizeForQuote(p.result.quote);
    if (quote.length < MIN_QUOTE_CHARS) {
      errors.push(`${where}.result.quote: too short to be checkable (${quote.length} chars)`);
    } else if (!text) {
      warnings.push(`${where}.result.quote: no paper text available to check against`);
    } else if (!normalizeForQuote(text).includes(quote)) {
      errors.push(`${where}.result.quote: not found verbatim in the paper text`);
    } else {
      quotesChecked += 1;
    }

    if (p.figure && !ctx.figureIds.get(p.id)?.has(p.figure.id)) {
      errors.push(`${where}.figure: ${p.figure.id} is not one of this paper's figures`);
    }
    if (p.because && p.becauseRefs.length === 0) {
      errors.push(`${where}.because: claims a feedback link but cites no becauseRefs`);
    }
    for (const ref of p.becauseRefs) {
      if (!ctx.feedbackRefs.has(ref)) {
        errors.push(`${where}.becauseRefs: "${ref}" is not in the reader's feedback`);
      }
    }
  }

  const inTheme = new Set();
  b.themes.forEach((t, i) => {
    for (const id of t.paperIds) {
      if (!paperIds.has(id)) errors.push(`themes[${i}]: cites ${id}, which is not a briefed paper`);
      inTheme.add(id);
    }
  });
  for (const id of paperIds) {
    if (!inTheme.has(id)) errors.push(`papers[${id}]: appears in no theme`);
  }

  if (!paperIds.has(b.readFirst.id)) {
    errors.push(`readFirst: ${b.readFirst.id} is not a briefed paper`);
  }
  if (b.papers.filter((p) => p.tier === 'read').length === 0) {
    warnings.push('no paper has tier "read"');
  }

  for (const nm of b.nearMisses) {
    if (paperIds.has(nm.id)) errors.push(`nearMisses[${nm.id}]: is also a briefed paper`);
    else if (!ctx.nearMissPool.has(nm.id)) {
      errors.push(`nearMisses[${nm.id}]: not a triaged YES/MAYBE paper from this harvest`);
    }
  }

  for (const prop of b.notes.proposals) {
    const where = `notes.proposals[${prop.id}]`;
    const target = ctx.targets?.[prop.target] ?? '';
    if (prop.edit.type === 'insert' && prop.edit.anchor === '' && target === '') continue;
    if (!prop.edit.anchor) errors.push(`${where}: empty anchor`);
    else if (!target.includes(prop.edit.anchor)) {
      errors.push(`${where}: anchor not found verbatim in ${prop.target}`);
    }
    if (prop.edit.type !== 'delete' && !prop.edit.content) {
      errors.push(`${where}: ${prop.edit.type} with empty content`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      papers: b.papers.length,
      themes: b.themes.length,
      nearMisses: b.nearMisses.length,
      quotesChecked,
      citationsChecked: paperIds.size + b.nearMisses.length,
      proposals: b.notes.proposals.length,
      questions: b.notes.questions.length,
    },
  };
}

// Apply an accepted proposal's edit to its target text. Returns null when
// the anchor no longer matches (the reader edited the file since).
export function applyProposalEdit(text, edit) {
  if (edit.type === 'insert' && edit.anchor === '')
    return `${text}${text ? '\n' : ''}${edit.content}`;
  const at = text.indexOf(edit.anchor);
  if (at === -1) return null;
  const end = at + edit.anchor.length;
  if (edit.type === 'insert') return text.slice(0, end) + edit.content + text.slice(end);
  if (edit.type === 'replace') return text.slice(0, at) + edit.content + text.slice(end);
  return text.slice(0, at) + text.slice(end);
}
