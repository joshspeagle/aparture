// End-of-run summary card rendered in MainArea between DownloadReportCard
// and BriefingView when one or more papers were skipped for lack of
// Playwright + reCAPTCHA. Returns null when the list is empty so zero-skip
// runs are visually unaffected.

import { Info } from 'lucide-react';
import Card from '../ui/Card.jsx';

export default function ReCaptchaSummaryCard({ skipped }) {
  if (!skipped || skipped.length === 0) return null;
  const count = skipped.length;

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          gap: 'var(--aparture-space-3)',
          alignItems: 'flex-start',
        }}
      >
        <Info className="w-5 h-5" style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }} />
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
            {count} paper{count === 1 ? '' : 's'} skipped deep analysis
          </div>
          <div
            style={{
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-mute)',
              marginBottom: '10px',
              fontFamily: 'var(--aparture-font-sans)',
            }}
          >
            These papers hit reCAPTCHA during PDF download. Install Playwright to enable the
            workaround on future runs:
          </div>
          <pre
            style={{
              background: 'var(--aparture-hover)',
              padding: '8px 10px',
              borderRadius: '4px',
              fontSize: 'var(--aparture-text-sm)',
              fontFamily: 'var(--aparture-font-mono)',
              margin: '0 0 12px',
              color: 'var(--aparture-ink)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            npx playwright install chromium
          </pre>
          <ul
            style={{
              fontSize: 'var(--aparture-text-sm)',
              margin: 0,
              paddingLeft: '18px',
              fontFamily: 'var(--aparture-font-sans)',
              color: 'var(--aparture-ink)',
            }}
          >
            {skipped.map((p) => (
              <li key={p.arxivId ?? p.id} style={{ marginBottom: '3px' }}>
                <span>{p.title}</span>{' '}
                <span
                  style={{
                    opacity: 0.7,
                    fontFamily: 'var(--aparture-font-mono)',
                    fontSize: '0.85em',
                  }}
                >
                  (arXiv:{p.arxivId})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
