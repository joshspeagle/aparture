// End-of-run summary card for calls a provider's safety classifier declined.
// Rendered in MainArea alongside ReCaptchaSummaryCard; returns null when
// nothing was refused, so runs without refusals are visually unaffected.
//
// Why this needs to be visible rather than a log line: under the default
// 'skip' policy a refusal silently removes papers from the briefing. Without
// a surface, the user sees a shorter briefing with no explanation and no way
// to tell that anything was dropped.

import { ShieldAlert } from 'lucide-react';
import Card from '../ui/Card.jsx';

const STAGE_LABELS = {
  filter: 'Quick filter',
  scoring: 'Abstract scoring',
  postProcessing: 'Score post-processing',
  pdf: 'Deep PDF analysis',
  briefing: 'Briefing synthesis',
};

export default function RefusalSummaryCard({ refusals }) {
  if (!refusals || refusals.length === 0) return null;
  const count = refusals.length;
  // Distinct providers, so the guidance can name the one that declined
  // rather than saying "the provider" when only one is involved.
  const providers = [...new Set(refusals.map((r) => r.provider).filter(Boolean))];

  return (
    <Card>
      <div style={{ display: 'flex', gap: 'var(--aparture-space-3)', alignItems: 'flex-start' }}>
        <ShieldAlert
          className="w-5 h-5"
          style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 'var(--aparture-text-base)',
              marginBottom: '6px',
              fontFamily: 'var(--aparture-font-sans)',
              color: 'var(--aparture-ink)',
            }}
          >
            {count} call{count === 1 ? '' : 's'} declined by a safety classifier
          </div>
          <div
            style={{
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-mute)',
              marginBottom: '10px',
              fontFamily: 'var(--aparture-font-sans)',
            }}
          >
            {providers.length === 1 ? providers[0] : 'A provider'} declined to process the content
            below, so it was skipped and the run continued. This is a content-policy decision by the
            provider, not an error in Aparture or in the papers. If it keeps happening, try a
            different model for the affected stage, or set{' '}
            <code style={{ fontFamily: 'var(--aparture-font-mono)' }}>refusalPolicy</code> to{' '}
            <code style={{ fontFamily: 'var(--aparture-font-mono)' }}>fallback</code> with a{' '}
            <code style={{ fontFamily: 'var(--aparture-font-mono)' }}>refusalFallbackModel</code>.
          </div>
          <ul
            style={{
              fontSize: 'var(--aparture-text-sm)',
              margin: 0,
              paddingLeft: '18px',
              fontFamily: 'var(--aparture-font-sans)',
              color: 'var(--aparture-ink)',
            }}
          >
            {refusals.map((r, i) => (
              <li key={`${r.stage}-${r.scope}-${i}`} style={{ marginBottom: '3px' }}>
                <span style={{ fontWeight: 500 }}>{STAGE_LABELS[r.stage] ?? r.stage}</span>
                {r.scope ? <span> — {r.scope}</span> : null}{' '}
                <span
                  style={{
                    opacity: 0.7,
                    fontFamily: 'var(--aparture-font-mono)',
                    fontSize: '0.85em',
                  }}
                >
                  ({r.category}
                  {r.raw && r.raw !== r.category ? `: ${r.raw}` : ''})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
