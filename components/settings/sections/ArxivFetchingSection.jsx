import Checkbox from '../../ui/Checkbox.jsx';
import Input from '../../ui/Input.jsx';
import {
  integerInputPropsFor,
  SECTION_TITLE_STYLE,
  FIELD_LABEL_STYLE,
  HELP_TEXT_STYLE,
} from '../shared.js';

export default function ArxivFetchingSection({ config, setConfig, processing }) {
  const integerInputProps = integerInputPropsFor({ config, setConfig, processing });
  return (
    <div
      style={{
        marginTop: 'var(--aparture-space-4)',
        paddingTop: 'var(--aparture-space-4)',
        borderTop: '1px solid var(--aparture-hairline)',
      }}
    >
      <p style={SECTION_TITLE_STYLE}>ArXiv Fetching</p>
      <div style={{ marginBottom: 'var(--aparture-space-3)' }}>
        <label style={FIELD_LABEL_STYLE}>Ingestion Mode</label>
        <div
          role="radiogroup"
          style={{
            display: 'inline-flex',
            border: '1px solid var(--aparture-hairline)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {[
            { value: 'auto', label: 'Auto (recommended)' },
            { value: 'oai-only', label: 'OAI-PMH only' },
            { value: 'atom-only', label: 'Atom only' },
          ].map((opt, idx) => {
            const selected = (config.arxivIngestion ?? 'auto') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setConfig((prev) => ({ ...prev, arxivIngestion: opt.value }))}
                disabled={processing.isRunning}
                style={{
                  padding: '6px 12px',
                  background: selected ? 'var(--aparture-accent)' : 'var(--aparture-bg)',
                  color: selected ? 'var(--aparture-bg)' : 'var(--aparture-ink)',
                  border: 'none',
                  borderLeft: idx === 0 ? 'none' : '1px solid var(--aparture-hairline)',
                  cursor: processing.isRunning ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-sm)',
                  fontWeight: selected ? 600 : 400,
                  opacity: processing.isRunning ? 0.6 : 1,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p style={HELP_TEXT_STYLE}>
          Auto tries OAI-PMH first, falls back to Atom on failure. Override only for debugging.
        </p>
      </div>
      <div style={{ marginBottom: 'var(--aparture-space-3)' }}>
        <label style={FIELD_LABEL_STYLE}>Window Semantics</label>
        <div
          role="radiogroup"
          style={{
            display: 'inline-flex',
            border: '1px solid var(--aparture-hairline)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {[
            { value: 'submitted-only', label: 'Submitted only' },
            { value: 'submitted-or-updated', label: 'Include updates' },
          ].map((opt, idx) => {
            const selected = (config.arxivWindowSemantics ?? 'submitted-only') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setConfig((prev) => ({ ...prev, arxivWindowSemantics: opt.value }))}
                disabled={processing.isRunning}
                style={{
                  padding: '6px 12px',
                  background: selected ? 'var(--aparture-accent)' : 'var(--aparture-bg)',
                  color: selected ? 'var(--aparture-bg)' : 'var(--aparture-ink)',
                  border: 'none',
                  borderLeft: idx === 0 ? 'none' : '1px solid var(--aparture-hairline)',
                  cursor: processing.isRunning ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-sm)',
                  fontWeight: selected ? 600 : 400,
                  opacity: processing.isRunning ? 0.6 : 1,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p style={HELP_TEXT_STYLE}>
          Submitted only matches legacy behavior; Include updates also surfaces v2 of older papers
        </p>
      </div>
      <div
        className="settings-field-row"
        style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}
      >
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Min Papers Per Subcategory</label>
          <Input {...integerInputProps('minPapersPerSubcategory', 5, 0, 100)} />
          <p style={HELP_TEXT_STYLE}>Floor before fill-ups trigger</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Fill-Up Lookback (Days)</label>
          <Input
            type="text"
            defaultValue={(config.lookbackExtensions ?? [3, 7, 14]).join(', ')}
            onBlur={(e) => {
              const parsed = e.target.value
                .split(',')
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => Number.isInteger(n) && n > 0 && n <= 365);
              const sorted = [...new Set(parsed)].sort((a, b) => a - b);
              setConfig((prev) => ({ ...prev, lookbackExtensions: sorted }));
            }}
            disabled={processing.isRunning}
          />
          <p style={HELP_TEXT_STYLE}>Comma-separated days for staged fill-ups</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Cache TTL (minutes)</label>
          <Input {...integerInputProps('arxivCacheTtlMinutes', 60, 0, 4320)} />
          <p style={HELP_TEXT_STYLE}>Reuse recent arXiv responses (0 disables)</p>
        </div>
      </div>
      <div style={{ marginTop: 'var(--aparture-space-3)' }}>
        <Checkbox
          label="Remove duplicate papers"
          description="Skip papers that appeared in any run in the last 90 days. When off, duplicates are kept but visibly marked."
          checked={config.removeDuplicates ?? true}
          onChange={(e) => setConfig((prev) => ({ ...prev, removeDuplicates: e.target.checked }))}
          disabled={processing.isRunning}
        />
      </div>
    </div>
  );
}
