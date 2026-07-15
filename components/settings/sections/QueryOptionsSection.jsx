import Input from '../../ui/Input.jsx';
import { integerInputPropsFor } from '../shared.js';

export default function QueryOptionsSection({ config, setConfig, processing }) {
  const integerInputProps = integerInputPropsFor({ config, setConfig, processing });
  return (
    <div>
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
        Query Options
      </p>
      <div
        className="settings-field-row"
        style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}
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
            Days to Look Back
          </label>
          {/* defaultVal must track DEFAULT_CONFIG.daysBack in
                        hooks/useAnalyzerPersistence.js */}
          <Input {...integerInputProps('daysBack', 1, 1, 30)} />
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            ArXiv search range
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
            Correction Attempts
          </label>
          <Input {...integerInputProps('maxCorrections', 1, 0, 5)} />
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Fix malformed responses
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
            Retry Attempts
          </label>
          {/* defaultVal must track DEFAULT_CONFIG.maxRetries in
                        hooks/useAnalyzerPersistence.js */}
          <Input {...integerInputProps('maxRetries', 4, 0, 10)} />
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Retry failed API calls
          </p>
        </div>
      </div>
    </div>
  );
}
