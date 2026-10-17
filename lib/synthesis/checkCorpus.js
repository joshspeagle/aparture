// Source corpus for the hallucination check (/api/check-briefing).
//
// The audit must judge the briefing against the SAME material the writer
// (/api/synthesize) was given, or grounded claims look unsupported and the
// default briefingRetryOnYes pays for a full re-synthesis. Per paper the
// writer sees (mapFinalRankingToBriefingPapers in briefingClient.js): title,
// relevance score, the scoring justification, the full report — whole, never
// truncated — the abstract, and the user's engagement (starred / dismissed /
// their own comments). So does the auditor.
//
// Quick summaries are deliberately NOT rendered: the writer never sees them,
// so a briefing claim that only a quick summary supports was not grounded in
// anything the writer had, and must not pass as "supported".

const fieldLines = (label, value) => (value ? [`  ${label}: ${value}`] : []);

export function renderCheckCorpus(papers) {
  if (!Array.isArray(papers) || papers.length === 0) return '(no papers)';
  return papers
    .map((p) => {
      const lines = [`- ${p.arxivId} "${p.title ?? ''}"`];
      if (typeof p.score === 'number') lines.push(`  Relevance score: ${p.score}`);

      const engagement = p.engagement ?? {};
      const marks = [engagement.starred && 'starred', engagement.dismissed && 'dismissed'].filter(
        Boolean
      );
      if (marks.length > 0) lines.push(`  User engagement: ${marks.join(', ')}`);
      const comments = Array.isArray(engagement.comments)
        ? engagement.comments.filter((c) => typeof c === 'string' && c.trim())
        : [];
      if (comments.length > 0) {
        lines.push('  User comments:', ...comments.map((c) => `    - ${c}`));
      }

      lines.push(...fieldLines('Abstract', p.abstract));
      lines.push(...fieldLines('Scoring justification', p.scoringJustification));
      lines.push(...fieldLines('Full report', p.fullReport));
      return lines.join('\n');
    })
    .join('\n\n');
}
