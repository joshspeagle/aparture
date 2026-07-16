import Input from '../../ui/Input.jsx';
import {
  integerInputPropsFor,
  SECTION_TITLE_STYLE,
  FIELD_LABEL_STYLE,
  HELP_TEXT_STYLE,
} from '../shared.js';

export default function BriefingOptionsSection({ config, setConfig, processing }) {
  const integerInputProps = integerInputPropsFor({ config, setConfig, processing });
  return (
    <div
      style={{
        marginTop: 'var(--aparture-space-4)',
        paddingTop: 'var(--aparture-space-4)',
        borderTop: '1px solid var(--aparture-hairline)',
      }}
    >
      <p style={SECTION_TITLE_STYLE}>Briefing Options</p>
      <div
        className="settings-field-row"
        style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}
      >
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Parallel Quick-Summary Calls</label>
          <Input {...integerInputProps('quickSummaryConcurrency', 5, 1, 20)} />
          <p style={HELP_TEXT_STYLE}>Max concurrent calls</p>
        </div>
      </div>
    </div>
  );
}
