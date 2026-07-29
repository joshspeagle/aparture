import Input from '../../ui/Input.jsx';
import Select from '../../ui/Select.jsx';
import { AVAILABLE_MODELS } from '../../../utils/models.js';
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

      {/* Safety-classifier refusals are deliberately separate from the retry
          knob above: they are deterministic, so they never enter the retry
          ladder and need their own policy. See lib/llm/RefusalError.js. */}
      <div
        className="settings-field-row"
        style={{
          display: 'flex',
          gap: 'var(--aparture-space-4)',
          marginTop: 'var(--aparture-space-4)',
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>On Safety Refusal</label>
          {/* default must track DEFAULT_CONFIG.refusalPolicy in
                        hooks/useAnalyzerPersistence.js */}
          <Select
            value={config.refusalPolicy ?? 'skip'}
            onChange={(e) => setConfig((prev) => ({ ...prev, refusalPolicy: e.target.value }))}
            disabled={processing.isRunning}
          >
            <option value="skip">Skip and continue</option>
            <option value="fallback">Retry on fallback model</option>
            <option value="fail">Stop the run</option>
          </Select>
          <p style={HELP_TEXT_STYLE}>When a provider declines on content grounds</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL_STYLE}>Fallback Model</label>
          <Select
            value={config.refusalFallbackModel ?? ''}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, refusalFallbackModel: e.target.value }))
            }
            disabled={processing.isRunning || (config.refusalPolicy ?? 'skip') !== 'fallback'}
          >
            <option value="">None</option>
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </Select>
          <p style={HELP_TEXT_STYLE}>Only used by the fallback policy</p>
        </div>
      </div>
    </div>
  );
}
