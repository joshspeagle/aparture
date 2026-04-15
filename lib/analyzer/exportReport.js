// Build + download the markdown analysis report.
// Extracted from components/ArxivAnalyzer.js (Phase 1.5.1 F4a).

export function buildReportMarkdown({ results, processingTiming, config }) {
  const timestamp = new Date().toLocaleString();
  const duration = processingTiming.duration ? Math.round(processingTiming.duration / 60000) : 0;

  const header = `# Aparture Analysis Report

**Generated:** ${timestamp}
**Duration:** ${duration} minutes
**Abstracts Screened:** ${results.scoredPapers.length}
**Papers Analyzed:** ${Math.min(results.scoredPapers.length, config.maxDeepAnalysis)}
**Final Report:** ${results.finalRanking.length}
**Categories:** ${config.selectedCategories.join(', ')}
**Models Used:** ${config.useQuickFilter ? config.filterModel + ' (filter), ' : ''}${config.scoringModel} (scoring), ${config.pdfModel} (PDF analysis)

---

`;

  const papers = results.finalRanking
    .map((paper, idx) => {
      const authorTag =
        paper.authors.length > 0
          ? paper.authors.length > 2
            ? `${paper.authors[0]} et al.`
            : paper.authors.join(' & ')
          : 'Unknown';

      return `## ${idx + 1}. ${paper.title}

**Score:** ${(paper.finalScore || paper.relevanceScore).toFixed(1)}/10
**arXiv ID:** [${paper.id}](https://arxiv.org/abs/${paper.id})
**Authors:** ${authorTag}

### Relevance Assessment
${paper.deepAnalysis?.relevanceAssessment || paper.scoreJustification}

### Key Findings
${paper.deepAnalysis?.keyFindings || 'N/A'}

### Methodology
${paper.deepAnalysis?.methodology || 'N/A'}

### Limitations
${paper.deepAnalysis?.limitations || 'N/A'}

### Detailed Technical Summary
${paper.deepAnalysis?.summary || 'No deep analysis available'}

---`;
    })
    .join('\n\n');

  return header + papers;
}

export function downloadBlob(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAnalysisReport({ results, processingTiming, config }) {
  const content = buildReportMarkdown({ results, processingTiming, config });
  const dateStr = processingTiming.startTime
    ? processingTiming.startTime.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const durationStr = processingTiming.duration
    ? `_${Math.round(processingTiming.duration / 60000)}min`
    : '';
  const filename = `${dateStr}_arxiv_analysis${durationStr}.md`;
  downloadBlob(content, filename);
}
