// Shared amber "this is mock data" pill. Replaces five hand-rolled copies
// (BriefingHeader, BriefingCard, FilterResultsList, AnalysisResultsList,
// DownloadReportCard). Each site keeps its own label and its own trigger —
// live testState.dryRunInProgress on the run surfaces, the persisted
// generationMetadata.testMode on the briefing header.

import { TestTube } from 'lucide-react';

export default function TestModeBadge({ label }) {
  return (
    <span
      style={{
        marginLeft: '12px',
        padding: '2px 8px',
        background: 'rgba(245,158,11,0.12)',
        color: '#f59e0b',
        fontSize: 'var(--aparture-text-xs)',
        fontFamily: 'var(--aparture-font-sans)',
        borderRadius: '9999px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      <TestTube className="w-3 h-3" />
      {label}
    </span>
  );
}
