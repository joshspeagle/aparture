import { Download } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import TestModeBadge from '../ui/TestModeBadge.jsx';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import { computeActualCost, formatUsd, STAGE_LABELS } from '../../lib/analyzer/costEstimate.js';

export default function DownloadReportCard({
  testState,
  processingTiming,
  results,
  processing,
  config,
  onExport,
}) {
  const hasReport = results.finalRanking.length > 0;

  // Actual run cost, computed from the token counts the API routes returned
  // (accumulated per stage during the run) and the registry pricing snapshot.
  // Dry runs record no usage, so nothing renders — not $0.00. Stages whose
  // model has no registry pricing are omitted from the breakdown and total.
  const costByStage = useAnalyzerStore((s) => s.costTracking.byStage);
  const actualCost = computeActualCost(costByStage);
  const pricedStages = actualCost.byStage.filter((s) => s.cost != null);
  const showCost = actualCost.hasUsage && actualCost.total != null;

  return (
    <Card>
      <div
        style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--aparture-space-3)' }}
      >
        <Download className="w-5 h-5" style={{ marginRight: '8px', color: '#22c55e' }} />
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xl)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
            margin: 0,
          }}
        >
          Download Report
        </h2>
        {testState.dryRunInProgress && <TestModeBadge label="TEST DATA" />}
      </div>

      {processingTiming.startTime && (
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            lineHeight: 1.6,
            margin: 0,
            marginBottom: 'var(--aparture-space-4)',
          }}
        >
          {processingTiming.endTime ? (
            <>
              Completed: {processingTiming.endTime.toLocaleString()}
              {' \u00b7 '}
              Duration:{' '}
              {processingTiming.duration ? Math.round(processingTiming.duration / 60000) : 0}{' '}
              minutes
              {' \u00b7 '}
              {results.scoredPapers.length} abstracts screened
              {' \u00b7 '}
              {Math.min(results.scoredPapers.length, config.maxDeepAnalysis)} papers analyzed
              {' \u00b7 '}
              {results.finalRanking.length} papers summarized
              {showCost && (
                <>
                  {' \u00b7 '}
                  est. cost {formatUsd(actualCost.total)}
                </>
              )}
            </>
          ) : processing.isRunning ? (
            <>
              Started: {processingTiming.startTime.toLocaleString()}
              {' \u00b7 '}
              Analysis in progress...
            </>
          ) : (
            `Last started: ${processingTiming.startTime.toLocaleString()}`
          )}
        </p>
      )}

      {/* Per-stage cost breakdown. Provider list prices drift, so this is
          labeled as an estimate from token counts, not a bill. */}
      {processingTiming.endTime && actualCost.hasUsage && pricedStages.length > 0 && (
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            lineHeight: 1.6,
            margin: 0,
            marginBottom: 'var(--aparture-space-4)',
          }}
        >
          {pricedStages.map((s) => `${STAGE_LABELS[s.stage]} ${formatUsd(s.cost)}`).join(' · ')}
          {' — estimated from token counts'}
        </p>
      )}

      <Button
        variant={hasReport ? 'primary' : 'secondary'}
        onClick={onExport}
        disabled={!hasReport}
        style={hasReport ? { background: '#22c55e', borderColor: '#22c55e' } : undefined}
      >
        <Download className="w-4 h-4" />
        {hasReport ? 'Download Report' : 'No Report Available'}
      </Button>
    </Card>
  );
}
