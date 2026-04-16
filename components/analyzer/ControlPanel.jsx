import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  TestTube,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

export default function ControlPanel({
  processing,
  testState,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onRunDryRun,
  onRunMinimalTest,
}) {
  const [showTestDropdown, setShowTestDropdown] = useState(false);

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
              style={{ borderColor: '#eab308', color: '#eab308' }}
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
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--aparture-space-4)',
              }}
            >
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
              <strong>Testing workflow:</strong> Run the dry test first to verify all components
              work correctly without API costs. Then run the minimal test to confirm real API
              integration with a small set of papers.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
