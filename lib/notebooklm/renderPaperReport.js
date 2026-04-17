// Renders a single paper's Stage-3 deep analysis into its own markdown
// file for upload as a standalone NotebookLM source. Returns
// { filename, content } — the filename is deterministic from arxivId
// and index so the caller can trust ordering in zip listings.

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
  const filename = `papers/${idx}-${paper.arxivId}-${slug}.md`;

  const score = paper.finalScore ?? paper.relevanceScore ?? 0;
  const summary = paper.deepAnalysis?.summary ?? 'No deep analysis available for this paper.';

  const content =
    [
      `# [P${index}] ${paper.title}`,
      '',
      `**arXiv:** ${paper.arxivId}`,
      `**Score:** ${score}/10`,
      `**Relevance:** ${paper.scoreJustification ?? 'No justification captured.'}`,
      '',
      summary,
    ].join('\n') + '\n';

  return { filename, content };
}
