import Checkbox from '../../ui/Checkbox.jsx';
import Input from '../../ui/Input.jsx';
import { integerInputPropsFor } from '../shared.js';

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
        Filter Options
      </p>
      <div
        className="settings-field-row"
        style={{
          display: 'flex',
          gap: 'var(--aparture-space-4)',
          alignItems: 'flex-end',
        }}
      >
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
            Filter Batch Size
          </label>
          <Input {...integerInputProps('filterBatchSize', 3, 1, 20)} />
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Papers per API call
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
            Parallel Filter Calls
          </label>
          <Input {...integerInputProps('filterConcurrency', 3, 1, 20)} />
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
        <div style={{ flex: 2 }}>
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
            Categories to Process
          </label>
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
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Filter results to score
          </p>
        </div>
      </div>
    </div>
  );
}
