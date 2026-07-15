import Input from '../../ui/Input.jsx';
import { integerInputPropsFor } from '../shared.js';

export default function PdfAnalysisSection({ config, setConfig, processing }) {
  const integerInputProps = integerInputPropsFor({ config, setConfig, processing });
  return (
    <div
      style={{
        marginTop: 'var(--aparture-space-4)',
        paddingTop: 'var(--aparture-space-4)',
        borderTop: '1px solid var(--aparture-hairline)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          fontWeight: 600,
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-2)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        PDF Analysis Options
      </p>
      <div style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}>
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: '4px',
            }}
          >
            Papers to Analyze
          </label>
          <Input {...integerInputProps('maxDeepAnalysis', 30, 1, 100)} />
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Number of PDFs to analyze
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: '4px',
            }}
          >
            Final Shortlist
          </label>
          <Input {...integerInputProps('finalOutputCount', 30, 1, 50)} />
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Top-ranked after deep analysis. Shown in the report and sent to the briefing.
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: '4px',
            }}
          >
            Parallel PDF Calls
          </label>
          <Input {...integerInputProps('pdfAnalysisConcurrency', 3, 1, 20)} />
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Max concurrent calls
          </p>
        </div>
      </div>
    </div>
  );
}
