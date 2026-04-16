import { Download, TestTube } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

export default function DownloadReportCard({
  testState,
  processingTiming,
  results,
  processing,
  config,
  onExport,
}) {
  const hasReport = results.finalRanking.length > 0;

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
        {testState.dryRunInProgress && (
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
            }}
          >
            <TestTube className="w-3 h-3" />
            TEST DATA
          </span>
        )}
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
