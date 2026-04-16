import { Loader2, Newspaper, TestTube } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';

export default function BriefingCard({
  results,
  testState,
  synthesizing,
  synthesisError,
  briefingCheckResult,
  briefingStage,
  processing,
  onGenerate,
}) {
  if (!results?.finalRanking?.length) return null;

  const verdictStyle = (verdict) => {
    if (verdict === 'NO')
      return {
        background: 'rgba(34,197,94,0.12)',
        color: '#22c55e',
      };
    if (verdict === 'MAYBE')
      return {
        background: 'rgba(245,158,11,0.12)',
        color: '#f59e0b',
      };
    return {
      background: 'rgba(239,68,68,0.12)',
      color: '#ef4444',
    };
  };

  return (
    <Card style={{ marginBottom: 'var(--aparture-space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Newspaper
            className="w-5 h-5"
            style={{ marginRight: '8px', color: 'var(--aparture-accent)' }}
          />
          <h2
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xl)',
              fontWeight: 600,
              color: 'var(--aparture-ink)',
              margin: 0,
            }}
          >
            Briefing
          </h2>
          {testState.dryRunInProgress && (
            <span
              style={{
                marginLeft: '12px',
                padding: '2px 8px',
                background: 'rgba(245,158,11,0.12)',
                color: '#f59e0b',
                fontSize: 'var(--aparture-text-xs)',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: 'var(--aparture-font-sans)',
              }}
            >
              <TestTube className="w-3 h-3" />
              TEST MODE
            </span>
          )}
        </div>
        {briefingCheckResult && (
          <span
            title={briefingCheckResult.justification}
            style={{
              padding: '2px 8px',
              fontSize: 'var(--aparture-text-xs)',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--aparture-font-sans)',
              ...verdictStyle(briefingCheckResult.verdict),
            }}
          >
            Hallucination check: {briefingCheckResult.verdict}
            {briefingCheckResult.retried && ' (after retry)'}
          </span>
        )}
      </div>

      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        Weave the top-ranked papers from this run into a structured reading view — executive
        summary, themes, and per-paper pitches — grounded in your profile. Runs on the briefing
        model configured above.
      </p>

      <Button
        variant={synthesizing || processing.isRunning ? 'secondary' : 'primary'}
        disabled={synthesizing || processing.isRunning}
        onClick={onGenerate}
      >
        {synthesizing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {briefingStage === 'checking'
              ? 'Auditing briefing\u2026'
              : briefingStage === 'retrying'
                ? 'Retrying\u2026'
                : 'Generating\u2026'}
          </>
        ) : (
          <>
            <Newspaper className="w-4 h-4" />
            Generate Briefing
          </>
        )}
      </Button>

      {synthesisError && (
        <p
          style={{
            marginTop: 'var(--aparture-space-2)',
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            color: 'var(--aparture-accent)',
          }}
        >
          Error: {synthesisError}
        </p>
      )}

      {briefingCheckResult &&
        briefingCheckResult.verdict !== 'NO' &&
        briefingCheckResult.flaggedClaims?.length > 0 && (
          <details
            style={{
              marginTop: 'var(--aparture-space-3)',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: '#f59e0b',
            }}
          >
            <summary style={{ cursor: 'pointer' }}>
              {briefingCheckResult.flaggedClaims.length} flagged claim
              {briefingCheckResult.flaggedClaims.length === 1 ? '' : 's'} &middot; click to view
            </summary>
            <ul
              style={{
                marginTop: 'var(--aparture-space-2)',
                paddingLeft: 'var(--aparture-space-4)',
                listStyle: 'disc',
              }}
            >
              {briefingCheckResult.flaggedClaims.map((claim, i) => (
                <li key={i} style={{ marginBottom: 'var(--aparture-space-2)' }}>
                  <div style={{ fontStyle: 'italic' }}>&quot;{claim.excerpt}&quot;</div>
                  {claim.paperArxivId && (
                    <div style={{ color: 'var(--aparture-mute)' }}>re: {claim.paperArxivId}</div>
                  )}
                  <div style={{ color: 'var(--aparture-mute)' }}>{claim.concern}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
    </Card>
  );
}
