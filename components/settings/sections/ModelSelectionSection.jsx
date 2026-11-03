import { AVAILABLE_MODELS, getModel, getModelsForPDF } from '../../../utils/models.js';
import Select from '../../ui/Select.jsx';

const MODEL_SLOTS = [
  {
    key: 'filterModel',
    id: 'setting-filterModel',
    label: 'Quick Filter Model',
    description:
      'Triages each paper as YES / MAYBE / NO based on your profile. Processes papers in small batches (configurable under Advanced Options) so even lightweight models work well here.',
    getValue: (config) => config.filterModel,
    getOptions: () => AVAILABLE_MODELS,
  },
  {
    key: 'scoringModel',
    id: 'setting-scoringModel',
    label: 'Abstract Scoring Model',
    description:
      'Reads each abstract and scores relevance 0–10 with a justification. This is where your profile has the most influence on paper ranking.',
    getValue: (config) => config.scoringModel,
    getOptions: () => AVAILABLE_MODELS,
  },
  {
    key: 'pdfModel',
    id: 'setting-pdfModel',
    label: 'Deep PDF Analysis Model',
    description:
      'Downloads and analyzes the full PDF for top-ranked papers. Produces detailed summaries, key findings, and methodology assessments. Benefits from a capable model.',
    getValue: (config) => config.pdfModel,
    getOptions: () => getModelsForPDF(),
  },
  {
    key: 'quickSummaryModel',
    id: 'setting-quickSummaryModel',
    label: 'Quick-Summary Model (briefing prep)',
    description:
      'Compresses each analyzed PDF into a ~300-word pre-read before briefing synthesis. Independent of the briefing model — lightweight models work well here.',
    getValue: (config) => config.quickSummaryModel ?? 'gemini-3.1-flash-lite',
    getOptions: () => AVAILABLE_MODELS,
  },
  {
    key: 'briefingModel',
    id: 'setting-briefingModel',
    label: 'Briefing Model (synthesis + suggest)',
    description:
      'Synthesizes the analyzed papers into a structured briefing, and also powers the Suggest Improvements flow on the Profile page.',
    getValue: (config) => config.briefingModel ?? config.pdfModel,
    getOptions: () => getModelsForPDF(),
  },
];

function ModelSlotField({ slot, config, setConfig, disabled }) {
  const value = slot.getValue(config);
  const options = slot.getOptions();

  return (
    <div>
      <label
        htmlFor={slot.id}
        style={{
          display: 'block',
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          fontWeight: 500,
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-2)',
        }}
      >
        {slot.label}
      </label>
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: '12px',
          color: 'var(--aparture-mute)',
          margin: '0 0 8px 0',
          lineHeight: 1.5,
        }}
      >
        {slot.description}
      </p>
      <Select
        id={slot.id}
        value={value}
        onChange={(e) => setConfig((prev) => ({ ...prev, [slot.key]: e.target.value }))}
        disabled={disabled}
      >
        {options.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </Select>
      <div
        style={{
          marginTop: 'var(--aparture-space-2)',
          padding: 'var(--aparture-space-2)',
          background: 'var(--aparture-bg)',
          borderRadius: '4px',
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
          {getModel(value)?.description}
        </p>
      </div>
    </div>
  );
}

export default function ModelSelectionSection({ config, setConfig, processing }) {
  return (
    <>
      <p
        style={{
          display: 'block',
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          fontWeight: 500,
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-2)',
        }}
      >
        AI Model Configuration
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(1, 1fr)',
          gap: 'var(--aparture-space-4)',
        }}
        className="md:grid-cols-3"
      >
        {MODEL_SLOTS.map((slot) => (
          <ModelSlotField
            key={slot.key}
            slot={slot}
            config={config}
            setConfig={setConfig}
            disabled={processing.isRunning}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 'var(--aparture-space-3)',
          padding: 'var(--aparture-space-3)',
          background: 'color-mix(in srgb, var(--aparture-accent) 8%, var(--aparture-surface))',
          border: '1px solid color-mix(in srgb, var(--aparture-accent) 25%, transparent)',
          borderRadius: '4px',
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
          <strong>Tip:</strong> Use cheaper, faster models for early filtering and scoring, and more
          capable models for PDF analysis and briefing synthesis.
        </p>
      </div>

      <div
        style={{
          marginTop: 'var(--aparture-space-4)',
          padding: 'var(--aparture-space-3)',
          background: 'var(--aparture-bg)',
          border: '1px solid var(--aparture-hairline)',
          borderRadius: '4px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            fontWeight: 500,
            color: 'var(--aparture-mute)',
            marginBottom: 'var(--aparture-space-2)',
          }}
        >
          Briefing hallucination check
        </p>
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            marginBottom: 'var(--aparture-space-3)',
          }}
        >
          After a briefing is generated, a second model call audits it for unsupported claims. If
          the check flags problems, the briefing is regenerated up to one additional time based on
          the criteria below.
        </p>
      </div>
    </>
  );
}
