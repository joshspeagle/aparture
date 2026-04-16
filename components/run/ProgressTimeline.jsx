// components/run/ProgressTimeline.jsx
// Six-stage vertical timeline for live pipeline progress.
// Reads processing state from the Zustand store and maps internal
// pipeline stages to user-facing labels with status icons.

import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

// Map internal pipeline stages to timeline stage indices.
// Pipeline stages: idle → fetching → Filtering → initial-scoring → selecting → deep-analysis → synthesizing → complete
const STAGE_ORDER = ['fetch', 'filter', 'score', 'postprocess', 'analyze', 'synthesize'];

function resolveStageIndex(pipelineStage) {
  const map = {
    idle: -1,
    fetching: 0,
    Filtering: 1,
    'filter-review': 1, // paused between filter and scoring
    'initial-scoring': 2,
    'Post-Processing': 3, // between scoring and deep analysis
    selecting: 3,
    'deep-analysis': 4,
    'pre-briefing-review': 5, // paused between analysis and briefing
    synthesizing: 5,
    complete: 6, // past all stages
  };
  return map[pipelineStage] ?? -1;
}

function stageStatus(stageIndex, currentIndex, isRunning) {
  if (stageIndex < currentIndex) return 'done';
  if (stageIndex === currentIndex && isRunning) return 'running';
  return 'pending';
}

function StageIcon({ status }) {
  const styles = {
    done: {
      color: '#22c55e', // green
      fontSize: 'var(--aparture-text-lg)',
      lineHeight: 1,
    },
    running: {
      color: '#f59e0b', // amber
      fontSize: 'var(--aparture-text-lg)',
      lineHeight: 1,
    },
    pending: {
      color: 'var(--aparture-mute)',
      fontSize: 'var(--aparture-text-lg)',
      lineHeight: 1,
    },
  };

  const icons = {
    done: '\u2713',
    running: '\u25cf',
    pending: '\u25cb',
  };

  return <span style={styles[status]}>{icons[status]}</span>;
}

function buildStageLabel(stageKey, status, progress, filterResults, results) {
  const labels = {
    fetch: {
      pending: 'Fetch papers',
      running:
        progress.total > 0
          ? `Fetching papers from ${progress.total} categories`
          : 'Fetching papers...',
      done: (() => {
        const totalPapers = results?.allPapers?.length ?? 0;
        return `${totalPapers} papers fetched`;
      })(),
    },
    filter: {
      pending: 'Filter papers',
      running: 'Filtering papers...',
      done: (() => {
        const y = filterResults?.yes?.length ?? 0;
        const m = filterResults?.maybe?.length ?? 0;
        const n = filterResults?.no?.length ?? 0;
        return `${y} YES / ${m} MAYBE / ${n} NO`;
      })(),
    },
    score: {
      pending: 'Score abstracts',
      running:
        progress.total > 0
          ? `Scoring abstracts (${progress.current}/${progress.total})...`
          : 'Scoring abstracts...',
      done: (() => {
        const count = results?.scoredPapers?.length ?? 0;
        return `${count} papers scored`;
      })(),
    },
    postprocess: {
      pending: 'Post-process scores',
      running: 'Post-processing scores...',
      done: 'Scores post-processed',
    },
    analyze: {
      pending: 'Analyze PDFs',
      running:
        progress.total > 0
          ? `Analyzing PDFs (${progress.current}/${progress.total})...`
          : 'Analyzing PDFs...',
      done: (() => {
        const count = results?.finalRanking?.length ?? 0;
        return `${count} papers analyzed`;
      })(),
    },
    synthesize: {
      pending: 'Generate briefing',
      running: 'Generating briefing...',
      done: 'Briefing generated',
    },
  };

  return labels[stageKey]?.[status] ?? stageKey;
}

export default function ProgressTimeline({
  onCycleVerdict: _onCycleVerdict,
  pauseAfterFilter,
  pauseBeforeBriefing,
  onContinueAfterFilter,
  onContinueAfterReview,
  children,
}) {
  const processing = useAnalyzerStore((s) => s.processing);
  const filterResults = useAnalyzerStore((s) => s.filterResults);
  const results = useAnalyzerStore((s) => s.results);

  const currentIndex = resolveStageIndex(processing.stage);
  const isRunning = processing.isRunning;

  const timelineStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    padding: 'var(--aparture-space-6) 0',
  };

  const stageRowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--aparture-space-4)',
    position: 'relative',
  };

  const iconColumnStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '24px',
    flexShrink: 0,
  };

  const connectorStyle = (status) => ({
    width: '2px',
    height: '24px',
    background: status === 'done' ? '#22c55e' : 'var(--aparture-hairline)',
  });

  const labelStyle = (status) => ({
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    color:
      status === 'done'
        ? 'var(--aparture-ink)'
        : status === 'running'
          ? '#f59e0b'
          : 'var(--aparture-mute)',
    fontWeight: status === 'running' ? 600 : 400,
    padding: 'var(--aparture-space-1) 0',
    lineHeight: 1.5,
  });

  const headerStyle = {
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-lg)',
    fontWeight: 600,
    color: 'var(--aparture-ink)',
    marginBottom: 'var(--aparture-space-4)',
  };

  // Show filter-pause UI when the pipeline has halted at the filter-review gate
  const showFilterPause = pauseAfterFilter && processing.stage === 'filter-review';
  // Show briefing-pause UI when the pipeline has halted at the pre-briefing-review gate
  const showBriefingPause = pauseBeforeBriefing && processing.stage === 'pre-briefing-review';
  const hasFilterResults =
    (filterResults?.yes?.length ?? 0) +
      (filterResults?.maybe?.length ?? 0) +
      (filterResults?.no?.length ?? 0) >
    0;

  return (
    <div>
      <div style={headerStyle}>Pipeline</div>
      <Card>
        <div style={timelineStyle}>
          {STAGE_ORDER.map((stageKey, idx) => {
            const status = stageStatus(idx, currentIndex, isRunning);
            const label = buildStageLabel(
              stageKey,
              status,
              processing.progress,
              filterResults,
              results
            );
            const isLast = idx === STAGE_ORDER.length - 1;

            return (
              <div key={stageKey}>
                <div style={stageRowStyle}>
                  <div style={iconColumnStyle}>
                    <StageIcon status={status} />
                    {!isLast && <div style={connectorStyle(status)} />}
                  </div>
                  <div style={labelStyle(status)}>{label}</div>
                </div>

                {/* Filter-pause interstitial */}
                {stageKey === 'filter' && showFilterPause && hasFilterResults && (
                  <div
                    style={{
                      marginLeft: '40px',
                      marginTop: 'var(--aparture-space-2)',
                      marginBottom: 'var(--aparture-space-2)',
                    }}
                  >
                    <Card>
                      <div
                        style={{
                          fontFamily: 'var(--aparture-font-sans)',
                          fontSize: 'var(--aparture-text-sm)',
                          color: 'var(--aparture-ink)',
                          marginBottom: 'var(--aparture-space-3)',
                        }}
                      >
                        Filter complete — review results before scoring:
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--aparture-font-mono)',
                          fontSize: 'var(--aparture-text-xs)',
                          color: 'var(--aparture-ink)',
                          marginBottom: 'var(--aparture-space-3)',
                        }}
                      >
                        {filterResults.yes?.length ?? 0} YES / {filterResults.maybe?.length ?? 0}{' '}
                        MAYBE / {filterResults.no?.length ?? 0} NO
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--aparture-font-sans)',
                          fontSize: 'var(--aparture-text-xs)',
                          color: 'var(--aparture-mute)',
                          marginBottom: 'var(--aparture-space-3)',
                        }}
                      >
                        Use the filter results panel below to override verdicts, then continue.
                      </div>
                      {onContinueAfterFilter && (
                        <Button variant="primary" onClick={onContinueAfterFilter}>
                          Continue to scoring →
                        </Button>
                      )}
                    </Card>
                  </div>
                )}

                {/* Pre-briefing-review pause interstitial */}
                {stageKey === 'synthesize' && showBriefingPause && (
                  <div
                    style={{
                      marginLeft: '40px',
                      marginTop: 'var(--aparture-space-2)',
                      marginBottom: 'var(--aparture-space-2)',
                    }}
                  >
                    <Card>
                      <div
                        style={{
                          fontFamily: 'var(--aparture-font-sans)',
                          fontSize: 'var(--aparture-text-sm)',
                          color: 'var(--aparture-ink)',
                          marginBottom: 'var(--aparture-space-3)',
                        }}
                      >
                        Analysis complete — review results and add stars/dismissals before
                        generating your briefing.
                      </div>
                      {onContinueAfterReview && (
                        <Button variant="primary" onClick={onContinueAfterReview}>
                          Continue to briefing →
                        </Button>
                      )}
                    </Card>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar when actively running */}
        {isRunning && processing.progress.total > 0 && (
          <div style={{ marginTop: 'var(--aparture-space-4)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                marginBottom: '4px',
              }}
            >
              <span>Progress</span>
              <span>
                {processing.progress.current} / {processing.progress.total}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '4px',
                background: 'var(--aparture-hairline)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${processing.progress.total > 0 ? Math.round((processing.progress.current / processing.progress.total) * 100) : 0}%`,
                  height: '100%',
                  background: 'var(--aparture-accent)',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Errors */}
        {processing.errors.length > 0 && (
          <div
            style={{
              marginTop: 'var(--aparture-space-4)',
              padding: 'var(--aparture-space-3)',
              background: 'var(--aparture-bg)',
              border: '1px solid var(--aparture-hairline)',
              borderRadius: '4px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-accent)',
                marginBottom: '4px',
              }}
            >
              Errors ({processing.errors.length})
            </div>
            <div
              style={{
                maxHeight: '120px',
                overflowY: 'auto',
                fontFamily: 'var(--aparture-font-mono)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
              }}
            >
              {processing.errors.map((error, idx) => (
                <div key={idx} style={{ marginBottom: '4px' }}>
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Render children (ControlPanel, DownloadReportCard, BriefingCard, etc.) */}
      {children}
    </div>
  );
}
