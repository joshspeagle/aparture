// Renders a structured briefing JSON into a self-contained markdown
// document suitable for upload as a NotebookLM source. Pure function,
// no side effects. Papers are listed below themes (which reference
// them by arxivId) so the reader — human or LLM — can resolve [P#]
// lookups in a single scroll.

export function renderBriefingMarkdown(briefing, { date }) {
  const parts = [];
  parts.push(`# ${date} Briefing`);
  parts.push('');
  parts.push('## Executive Summary');
  parts.push(briefing.executiveSummary ?? '');

  const themes = briefing.themes ?? [];
  themes.forEach((theme, i) => {
    parts.push('');
    parts.push(`## Theme ${i + 1} — ${theme.title}`);
    parts.push(theme.argument ?? '');
    if (theme.paperIds?.length) {
      parts.push('');
      parts.push(`Papers: ${theme.paperIds.join(', ')}`);
    }
  });

  const papers = briefing.papers ?? [];
  if (papers.length > 0) {
    parts.push('');
    parts.push('## Papers');
    papers.forEach((p, i) => {
      parts.push('');
      parts.push(`### [P${i + 1}] ${p.title}`);
      parts.push(`- arXiv: ${p.arxivId}`);
      parts.push(`- Score: ${p.score}/10`);
      if (p.onelinePitch) parts.push(`- Pitch: ${p.onelinePitch}`);
      if (p.whyMatters) parts.push(`- Why it matters: ${p.whyMatters}`);
    });
  }

  return parts.join('\n') + '\n';
}
