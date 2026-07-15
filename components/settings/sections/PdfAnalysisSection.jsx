import Input from '../../ui/Input.jsx';
import {
  integerInputPropsFor,
  SECTION_TITLE_STYLE,
  FIELD_LABEL_STYLE,
  HELP_TEXT_STYLE,
} from '../shared.js';

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
      <p style={SECTION_TITLE_STYLE}>PDF Analysis Options</p>
      <div
        className="settings-field-row"
        style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}
      >
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Papers to Analyze</label>
          <Input {...integerInputProps('maxDeepAnalysis', 30, 1, 100)} />
          <p style={HELP_TEXT_STYLE}>Number of PDFs to analyze</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Final Shortlist</label>
          <Input {...integerInputProps('finalOutputCount', 30, 1, 50)} />
          <p style={HELP_TEXT_STYLE}>
            Top-ranked after deep analysis. Shown in the report and sent to the briefing.
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Parallel PDF Calls</label>
          <Input {...integerInputProps('pdfAnalysisConcurrency', 3, 1, 20)} />
          <p style={HELP_TEXT_STYLE}>Max concurrent calls</p>
        </div>
      </div>
    </div>
  );
}
