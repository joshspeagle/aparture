// Compose the full per-paper report text from Stage 3's structured
// deepAnalysis output.
//
// Stage 3 (`pages/api/analyze-pdf.js`) returns five prose fields plus
// an `updatedScore`:
//   - summary              (3-5 paragraph technical summary)
//   - keyFindings          (1 paragraph on results)
//   - methodology          (1 paragraph on methods)
//   - limitations          (1 paragraph on limitations / future work)
//   - relevanceAssessment  (1 paragraph on why it matters to the user)
//
// This helper concatenates all five into a single markdown document
// with H2 sub-headings so downstream consumers (the briefing synthesis
// prompt, hallucination check corpus, NotebookLM per-paper sources,
// the briefing view's full-report side panel) see the complete output.
// Previously only the `summary` field was used — dropping ~80% of the
// LLM's structured output.
//
// Falls back through legacy field names (`detailedSummary`,
// `pdfAnalysis.summary`, `analysis`) for older cached paper shapes.
// Returns '' when nothing is available; callers decide whether to
// substitute a placeholder.

export function composeFullReport(paper) {
  const da = paper?.deepAnalysis;
  if (da) {
    const parts = [];
    if (da.summary) parts.push(`## Summary\n\n${da.summary}`);
    if (da.keyFindings) parts.push(`## Key findings\n\n${da.keyFindings}`);
    if (da.methodology) parts.push(`## Methodology\n\n${da.methodology}`);
    if (da.limitations) parts.push(`## Limitations\n\n${da.limitations}`);
    if (da.relevanceAssessment) parts.push(`## Relevance\n\n${da.relevanceAssessment}`);
    if (parts.length > 0) return parts.join('\n\n');
  }
  return paper?.detailedSummary ?? paper?.pdfAnalysis?.summary ?? paper?.analysis ?? '';
}
