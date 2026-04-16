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

  const testBadgeStyle = {
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
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <Download className="w-5 h-5" style={{ marginRight: '8px', color: '#22c55e' }} />
            <h2
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xl)',
                fontWeight: 600,
                color: 'var(--aparture-ink)',
              }}
            >
              Download Report
            </h2>
            {testState.dryRunInProgress && (
              <span style={testBadgeStyle}>
                <TestTube className="w-3 h-3" />
                TEST DATA
              </span>
            )}
          </div>

          {processingTiming.startTime && (
            <div
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                color: 'var(--aparture-mute)',
                marginBottom: 'var(--aparture-space-3)',
              }}
            >
              {processingTiming.endTime ? (
                <>
                  Completed: {processingTiming.endTime.toLocaleString()}
                  <span style={{ margin: '0 8px' }}>&bull;</span>
                  Duration:{' '}
                  {processingTiming.duration
                    ? Math.round(processingTiming.duration / 60000)
                    : 0}{' '}
                  minutes
                  <span style={{ margin: '0 8px' }}>&bull;</span>
                  {results.scoredPapers.length} abstracts screened
                  <span style={{ margin: '0 8px' }}>&bull;</span>
                  {Math.min(results.scoredPapers.length, config.maxDeepAnalysis)} papers analyzed
                  <span style={{ margin: '0 8px' }}>&bull;</span>
                  {results.finalRanking.length} papers summarized
                </>
              ) : processing.isRunning ? (
                <>
                  Started: {processingTiming.startTime.toLocaleString()}
                  <span style={{ margin: '0 8px' }}>&bull;</span>
                  Analysis in progress...
                </>
              ) : (
                `Last started: ${processingTiming.startTime.toLocaleString()}`
              )}
            </div>
          )}
        </div>

        <Button
          variant={hasReport ? 'primary' : 'secondary'}
          onClick={onExport}
          disabled={!hasReport}
          style={hasReport ? { background: '#22c55e', borderColor: '#22c55e' } : undefined}
        >
          <Download className="w-4 h-4" />
          {hasReport ? 'Download Report' : 'No Report Available'}
        </Button>
      </div>
    </Card>
  );
}
