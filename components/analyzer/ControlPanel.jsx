import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  TestTube,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

// Per-check chip for the API Setup Check results. Uses the shared semantic
// status colors (#22c55e done / #ef4444 error); a null check means "not
// validated by this probe" and renders muted.
function CheckChip({ label, value }) {
  const color = value === true ? '#22c55e' : value === false ? '#ef4444' : 'var(--aparture-mute)';
  const symbol = value === true ? '✓' : value === false ? '✗' : '—';
  return (
    <span
      style={{
        fontFamily: 'var(--aparture-font-sans)',
        fontSize: 'var(--aparture-text-xs)',
        color,
        marginRight: '10px',
        whiteSpace: 'nowrap',
      }}
    >
      {label} {symbol}
    </span>
  );
}

export default function ControlPanel({
  processing,
  testState,
  config,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onRunDryRun,
  onRunMinimalTest,
}) {
  const [showTestDropdown, setShowTestDropdown] = useState(false);
  const [setupCheck, setSetupCheck] = useState({
    running: false,
    results: null,
    error: null,
    lastTime: null,
  });
  const password = useAnalyzerStore((s) => s.password);
  const notebookLMModel = useAnalyzerStore((s) => s.notebookLM.notebookLMModel);

  const runSetupCheck = async () => {
    const slotDefs = [
      ['Filter', config?.filterModel],
      ['Scoring', config?.scoringModel],
      ['Post-processing', config?.postProcessingModel],
      ['PDF analysis', config?.pdfModel],
      ['Briefing', config?.briefingModel],
      ['Quick summaries', config?.quickSummaryModel],
      ['NotebookLM', notebookLMModel],
    ];
    const slots = slotDefs.filter(([, model]) => !!model).map(([slot, model]) => ({ slot, model }));
    setSetupCheck((prev) => ({ ...prev, running: true, error: null }));
    try {
      const res = await fetch('/api/validate-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSetupCheck({ running: false, results: data.results, error: null, lastTime: new Date() });
    } catch (err) {
      setSetupCheck((prev) => ({
        ...prev,
        running: false,
        results: null,
        error: err.message,
      }));
    }
  };

  // Slots that share a model get identical probe results — group them so
  // seven slots on two models render as two rows, not seven.
  const groupedSetupResults = (() => {
    if (!setupCheck.results) return null;
    const groups = new Map();
    for (const result of setupCheck.results) {
      if (!groups.has(result.model)) {
        groups.set(result.model, { ...result, slots: [] });
      }
      groups.get(result.model).slots.push(result.slot);
    }
    return [...groups.values()];
  })();

  const setupCheckPassed =
    !!setupCheck.lastTime && !!setupCheck.results && setupCheck.results.every((r) => r.ok);

  const testCardStyle = {
    background: 'var(--aparture-bg)',
    borderRadius: '4px',
    padding: 'var(--aparture-space-4)',
    border: '1px solid var(--aparture-hairline)',
  };

  const statusDotStyle = (isComplete) => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginRight: '8px',
    background: isComplete ? '#22c55e' : 'var(--aparture-mute)',
  });

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--aparture-space-3)' }}>
          {!processing.isRunning && (
            <Button variant="primary" onClick={onStart}>
              <Play className="w-4 h-4" />
              Start Analysis
            </Button>
          )}

          {processing.isRunning && !processing.isPaused && (
            <Button
              variant="secondary"
              onClick={onPause}
              style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
            >
              <Pause className="w-4 h-4" />
              Pause
            </Button>
          )}

          {processing.isRunning && processing.isPaused && (
            <Button
              variant="secondary"
              onClick={onResume}
              style={{ borderColor: '#22c55e', color: '#22c55e' }}
            >
              <Play className="w-4 h-4" />
              Resume
            </Button>
          )}

          {processing.isRunning && (
            <Button
              variant="secondary"
              onClick={onStop}
              style={{ borderColor: '#ef4444', color: '#ef4444' }}
            >
              <Square className="w-4 h-4" />
              Stop
            </Button>
          )}

          <Button variant="secondary" onClick={onReset}>
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowTestDropdown(!showTestDropdown)}
          style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            color: 'var(--aparture-mute)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'color 150ms ease',
          }}
        >
          {showTestDropdown ? (
            <ChevronDown className="w-4 h-4" style={{ marginRight: '4px' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ marginRight: '4px' }} />
          )}
          System Tests
        </button>

        {showTestDropdown && (
          <div
            style={{
              marginTop: 'var(--aparture-space-3)',
              paddingLeft: '20px',
              borderLeft: '2px solid var(--aparture-hairline)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--aparture-space-3)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 'var(--aparture-space-4)',
              }}
            >
              <div style={testCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={statusDotStyle(setupCheckPassed)} />
                  <h3
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontWeight: 500,
                      color: 'var(--aparture-ink)',
                    }}
                  >
                    API Setup Check
                  </h3>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-sm)',
                    color: 'var(--aparture-mute)',
                    marginBottom: 'var(--aparture-space-3)',
                  }}
                >
                  Verifies your keys, model IDs, and request syntax against each provider. Free — no
                  tokens are sampled.
                </p>
                {setupCheck.lastTime && (
                  <p
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: 'var(--aparture-mute)',
                      marginBottom: 'var(--aparture-space-3)',
                    }}
                  >
                    Last run: {setupCheck.lastTime.toLocaleString()}
                  </p>
                )}
                <Button
                  variant={setupCheck.running ? 'secondary' : 'primary'}
                  onClick={runSetupCheck}
                  disabled={setupCheck.running}
                  style={{ width: '100%' }}
                >
                  {setupCheck.running ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Check API Setup
                    </>
                  )}
                </Button>
                {setupCheck.error && (
                  <p
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: '#ef4444',
                      marginTop: 'var(--aparture-space-3)',
                    }}
                  >
                    {setupCheck.error}
                  </p>
                )}
                {groupedSetupResults && (
                  <div style={{ marginTop: 'var(--aparture-space-3)' }}>
                    {groupedSetupResults.map((group) => (
                      <div
                        key={group.model}
                        style={{
                          padding: '6px 0',
                          borderTop: '1px solid var(--aparture-hairline)',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--aparture-font-sans)',
                            fontSize: 'var(--aparture-text-xs)',
                            color: 'var(--aparture-ink)',
                            marginBottom: '2px',
                          }}
                        >
                          {group.slots.join(', ')} · {group.model}
                        </div>
                        <div>
                          <CheckChip label="Key" value={group.checks?.key ?? null} />
                          <CheckChip label="Model" value={group.checks?.model ?? null} />
                          <CheckChip label="Syntax" value={group.checks?.requestShape ?? null} />
                        </div>
                        {(!group.ok || group.checks?.requestShape === null) && group.message && (
                          <div
                            style={{
                              fontFamily: 'var(--aparture-font-sans)',
                              fontSize: 'var(--aparture-text-xs)',
                              color: group.ok ? 'var(--aparture-mute)' : '#ef4444',
                              marginTop: '2px',
                            }}
                          >
                            {group.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={testCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={statusDotStyle(testState.dryRunCompleted)} />
                  <h3
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontWeight: 500,
                      color: 'var(--aparture-ink)',
                    }}
                  >
                    Dry Run Test
                  </h3>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-sm)',
                    color: 'var(--aparture-mute)',
                    marginBottom: 'var(--aparture-space-3)',
                  }}
                >
                  Tests all components with mock APIs. No API costs incurred.
                </p>
                {testState.lastDryRunTime && (
                  <p
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: 'var(--aparture-mute)',
                      marginBottom: 'var(--aparture-space-3)',
                    }}
                  >
                    Last run: {testState.lastDryRunTime.toLocaleString()}
                  </p>
                )}
                <Button
                  variant={
                    testState.dryRunInProgress || processing.isRunning ? 'secondary' : 'primary'
                  }
                  onClick={onRunDryRun}
                  disabled={testState.dryRunInProgress || processing.isRunning}
                  style={{ width: '100%' }}
                >
                  {testState.dryRunInProgress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : testState.dryRunCompleted ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Run Again
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4" />
                      Run Dry Test
                    </>
                  )}
                </Button>
              </div>

              <div style={testCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={statusDotStyle(!!testState.lastMinimalTestTime)} />
                  <h3
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontWeight: 500,
                      color: 'var(--aparture-ink)',
                    }}
                  >
                    Minimal API Test
                  </h3>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-sm)',
                    color: 'var(--aparture-mute)',
                    marginBottom: 'var(--aparture-space-3)',
                  }}
                >
                  Tests with 5 hardcoded papers using real APIs. Incurs costs.
                </p>
                {testState.lastMinimalTestTime && (
                  <p
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: 'var(--aparture-mute)',
                      marginBottom: 'var(--aparture-space-3)',
                    }}
                  >
                    Last run: {testState.lastMinimalTestTime.toLocaleString()}
                  </p>
                )}
                <Button
                  variant={
                    !testState.dryRunCompleted ||
                    testState.minimalTestInProgress ||
                    processing.isRunning
                      ? 'secondary'
                      : 'primary'
                  }
                  onClick={onRunMinimalTest}
                  disabled={
                    !testState.dryRunCompleted ||
                    testState.minimalTestInProgress ||
                    processing.isRunning
                  }
                  style={{ width: '100%' }}
                >
                  {testState.minimalTestInProgress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : !testState.dryRunCompleted ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      Run Dry Test First
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Run API Test
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
              }}
            >
              <strong>Testing workflow:</strong> Run the setup check first — it verifies keys, model
              IDs, and request syntax against each provider without sampling tokens. Then run the
              dry test to verify all components work correctly without API costs, and the minimal
              test to confirm real API integration with a small set of papers.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
