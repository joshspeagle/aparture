// Per-paper in-timeline notice rendered by ProgressTimeline when the
// pipeline skips a PDF because Playwright isn't available for reCAPTCHA
// bypass. The end-of-run summary card (ReCaptchaSummaryCard) lists every
// skipped paper once the run completes; this component is the inline
// notice users see during the run.
//
// Visual: amber/yellow tinted card with a warning icon and the install
// command inline. Uses semantic status colour #eab308 (MAYBE/warning)
// from CLAUDE.md's status table.

import { AlertTriangle } from 'lucide-react';

export default function PlaywrightNotice({ arxivId, title }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 'var(--aparture-space-3)',
        padding: 'var(--aparture-space-3) var(--aparture-space-4)',
        background: 'rgba(234, 179, 8, 0.08)',
        borderLeft: '3px solid #eab308',
        borderRadius: '4px',
        fontSize: 'var(--aparture-text-sm)',
        lineHeight: 1.5,
        color: 'var(--aparture-ink)',
        marginTop: 'var(--aparture-space-2)',
      }}
    >
      <AlertTriangle
        className="w-4 h-4"
        style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }}
      />
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div
          style={{
            opacity: 0.75,
            fontFamily: 'var(--aparture-font-mono)',
            fontSize: '0.85em',
          }}
        >
          arXiv:{arxivId}
        </div>
        <div style={{ marginTop: '4px' }}>
          PDF blocked by reCAPTCHA. Install Playwright to enable the workaround:{' '}
          <code
            style={{
              fontFamily: 'var(--aparture-font-mono)',
              fontSize: '0.9em',
            }}
          >
            npx playwright install chromium
          </code>
          . Paper will be included based on abstract-level analysis only.
        </div>
      </div>
    </div>
  );
}
