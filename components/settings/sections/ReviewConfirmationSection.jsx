import Checkbox from '../../ui/Checkbox.jsx';

export default function ReviewConfirmationSection({ config, setConfig, processing }) {
  return (
    <div
      style={{
        marginTop: 'var(--aparture-space-6)',
        padding: 'var(--aparture-space-4)',
        background: 'var(--aparture-surface)',
        border: '1px solid var(--aparture-hairline)',
        borderRadius: '4px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          fontWeight: 600,
          color: 'var(--aparture-ink)',
          marginBottom: 'var(--aparture-space-3)',
        }}
      >
        Review & confirmation
      </p>
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        Training wheels — turn these off as you build trust in your pipeline setup.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--aparture-space-3)',
        }}
      >
        <Checkbox
          label="Pause after filter to review overrides"
          checked={config.pauseAfterFilter ?? true}
          onChange={(e) => setConfig((prev) => ({ ...prev, pauseAfterFilter: e.target.checked }))}
          disabled={processing.isRunning}
        />
        <Checkbox
          label="Pause before deep analysis"
          checked={config.pauseBeforeDeepAnalysis ?? true}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, pauseBeforeDeepAnalysis: e.target.checked }))
          }
          disabled={processing.isRunning}
        />
        <Checkbox
          label="Pause before briefing to review scores and add feedback"
          checked={config.pauseBeforeBriefing ?? true}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, pauseBeforeBriefing: e.target.checked }))
          }
          disabled={processing.isRunning}
        />
        <Checkbox
          label="Auto-retry briefing if hallucination check returns YES"
          checked={config.briefingRetryOnYes ?? true}
          onChange={(e) => setConfig((prev) => ({ ...prev, briefingRetryOnYes: e.target.checked }))}
          disabled={processing.isRunning}
        />
        <Checkbox
          label="Auto-retry briefing if hallucination check returns MAYBE"
          checked={config.briefingRetryOnMaybe ?? false}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, briefingRetryOnMaybe: e.target.checked }))
          }
          disabled={processing.isRunning}
        />
      </div>
    </div>
  );
}
