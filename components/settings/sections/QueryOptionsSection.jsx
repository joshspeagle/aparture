import Input from '../../ui/Input.jsx';
import {
  integerInputPropsFor,
  SECTION_TITLE_STYLE,
  FIELD_LABEL_STYLE,
  HELP_TEXT_STYLE,
} from '../shared.js';

export default function QueryOptionsSection({ config, setConfig, processing }) {
  const integerInputProps = integerInputPropsFor({ config, setConfig, processing });
  return (
    <div>
      <p style={SECTION_TITLE_STYLE}>Query Options</p>
      <div
        className="settings-field-row"
        style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}
      >
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Days to Look Back</label>
          {/* defaultVal must track DEFAULT_CONFIG.daysBack in
                        hooks/useAnalyzerPersistence.js */}
          <Input {...integerInputProps('daysBack', 1, 1, 30)} />
          <p style={HELP_TEXT_STYLE}>ArXiv search range</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Correction Attempts</label>
          <Input {...integerInputProps('maxCorrections', 1, 0, 5)} />
          <p style={HELP_TEXT_STYLE}>Fix malformed responses</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Retry Attempts</label>
          {/* defaultVal must track DEFAULT_CONFIG.maxRetries in
                        hooks/useAnalyzerPersistence.js */}
          <Input {...integerInputProps('maxRetries', 4, 0, 10)} />
          <p style={HELP_TEXT_STYLE}>Retry failed API calls</p>
        </div>
      </div>
    </div>
  );
}
