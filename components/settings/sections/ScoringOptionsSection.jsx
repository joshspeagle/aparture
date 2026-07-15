import Checkbox from '../../ui/Checkbox.jsx';
import Input from '../../ui/Input.jsx';
import { integerInputPropsFor } from '../shared.js';

export default function ScoringOptionsSection({ config, setConfig, processing }) {
  const integerInputProps = integerInputPropsFor({ config, setConfig, processing });
  return (
    <div
      style={{
        marginTop: 'var(--aparture-space-4)',
        paddingTop: 'var(--aparture-space-4)',
        borderTop: '1px solid var(--aparture-hairline)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--aparture-space-2)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            fontWeight: 600,
            color: 'var(--aparture-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          Abstract Scoring Options
        </p>
        <Checkbox
          label="Enable Post-Processing"
          checked={config.enableScorePostProcessing}
          onChange={(e) =>
            setConfig((prev) => ({
              ...prev,
              enableScorePostProcessing: e.target.checked,
            }))
          }
          disabled={processing.isRunning}
        />
      </div>
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
            Scoring Batch Size
          </label>
          <Input {...integerInputProps('scoringBatchSize', 3, 1, 10)} />
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
            Parallel Scoring Calls
          </label>
          <Input {...integerInputProps('scoringConcurrency', 3, 1, 20)} />
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
        {config.enableScorePostProcessing && (
          <>
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
                Review Batch Size
              </label>
              <Input {...integerInputProps('postProcessingBatchSize', 5, 3, 10)} />
              <p
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                  marginTop: '4px',
                }}
              >
                Papers per comparison
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
                Parallel Review Calls
              </label>
              <Input {...integerInputProps('postProcessingConcurrency', 3, 1, 20)} />
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
                Papers to Review
              </label>
              <Input {...integerInputProps('postProcessingCount', 50, 5, 200)} />
              <p
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                  marginTop: '4px',
                }}
              >
                Top papers to post-process
              </p>
            </div>
          </>
        )}
      </div>
      {config.enableScorePostProcessing && (
        <div
          style={{
            background: 'var(--aparture-bg)',
            borderRadius: '4px',
            padding: 'var(--aparture-space-2)',
            marginTop: 'var(--aparture-space-2)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              margin: 0,
            }}
          >
            Post-processing reviews initial scores for consistency by comparing papers in batches.
            This helps correct scoring errors from complex research criteria.
          </p>
        </div>
      )}
    </div>
  );
}
