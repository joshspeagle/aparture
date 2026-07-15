import Checkbox from '../../ui/Checkbox.jsx';
import Input from '../../ui/Input.jsx';
import {
  integerInputPropsFor,
  SECTION_TITLE_STYLE,
  FIELD_LABEL_STYLE,
  HELP_TEXT_STYLE,
} from '../shared.js';

export default function FilterOptionsSection({ config, setConfig, processing }) {
  const integerInputProps = integerInputPropsFor({ config, setConfig, processing });
  return (
    <div
      style={{
        marginTop: 'var(--aparture-space-4)',
        paddingTop: 'var(--aparture-space-4)',
        borderTop: '1px solid var(--aparture-hairline)',
      }}
    >
      <p style={SECTION_TITLE_STYLE}>Filter Options</p>
      <div
        className="settings-field-row"
        style={{
          display: 'flex',
          gap: 'var(--aparture-space-4)',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Filter Batch Size</label>
          <Input {...integerInputProps('filterBatchSize', 3, 1, 20)} />
          <p style={HELP_TEXT_STYLE}>Papers per API call</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Parallel Filter Calls</label>
          <Input {...integerInputProps('filterConcurrency', 3, 1, 20)} />
          <p style={HELP_TEXT_STYLE}>Max concurrent calls</p>
        </div>
        <div style={{ flex: 2 }}>
          <label style={FIELD_LABEL_STYLE}>Categories to Process</label>
          <div
            style={{
              display: 'flex',
              // Wrap so YES/MAYBE/NO checkboxes never force horizontal
              // overflow inside a narrow (mobile) field; inert on desktop.
              flexWrap: 'wrap',
              gap: 'var(--aparture-space-4)',
              padding: '6px 0',
            }}
          >
            {['YES', 'MAYBE', 'NO'].map((category) => (
              <Checkbox
                key={category}
                label={category}
                checked={config.categoriesToScore.includes(category)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setConfig((prev) => ({
                      ...prev,
                      categoriesToScore: [...prev.categoriesToScore, category],
                    }));
                  } else {
                    setConfig((prev) => ({
                      ...prev,
                      categoriesToScore: prev.categoriesToScore.filter((c) => c !== category),
                    }));
                  }
                }}
                disabled={processing.isRunning}
              />
            ))}
          </div>
          <p style={HELP_TEXT_STYLE}>Filter results to score</p>
        </div>
      </div>
    </div>
  );
}
