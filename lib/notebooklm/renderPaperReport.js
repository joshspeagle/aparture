// Renders a single paper's Stage-3 deep analysis into its own markdown
// file for upload as a standalone NotebookLM source. Returns
// { filename, content } — the filename is deterministic from arxivId
// and index so the caller can trust ordering in zip listings.
//
// The body is the full multi-section Stage 3 output (summary + key
// findings + methodology + limitations + relevance). See
// `lib/analyzer/composeFullReport.js` for the exact composition.

import { composeFullReport } from '../analyzer/composeFullReport.js';

function slugify(title, maxLength = 60) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
  return slug || 'untitled';
}

export function renderPaperReport(paper, index) {
  const idx = String(index).padStart(2, '0');
  const slug = slugify(paper.title ?? '');
  // Pipeline `finalRanking` papers carry the ID under `id` (arxiv module's
  // Paper type), while papers that have round-tripped through
  // mapFinalRankingToBriefingPapers carry it under `arxivId`. Accept either
  // — without this fallback the report renders `**arXiv:** undefined`.
  const arxivId = paper.arxivId ?? paper.id ?? 'unknown';
  // Old-style arXiv IDs contain a slash (astro-ph/0601001) which would nest
  // an unexpected folder inside the ZIP and break the flat papers/ listing.
  // Sanitize for the FILENAME only — the report body keeps the real ID.
  const fileSafeArxivId = arxivId.replace(/\//g, '-');

  const score = paper.finalScore ?? paper.relevanceScore ?? 0;
  const body = composeFullReport(paper) || 'No deep analysis available for this paper.';

  const content =
    [
      `# [P${index}] ${paper.title}`,
      '',
      `**arXiv:** ${arxivId}`,
      `**Score:** ${score}/10`,
      `**Relevance:** ${paper.scoreJustification ?? 'No justification captured.'}`,
      '',
      body,
    ].join('\n') + '\n';

  return { filename: `papers/${idx}-${fileSafeArxivId}-${slug}.md`, content };
}
