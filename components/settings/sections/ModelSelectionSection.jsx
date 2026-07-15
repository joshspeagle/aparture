import { AVAILABLE_MODELS, getModel, getModelsForPDF } from '../../../utils/models.js';
import Select from '../../ui/Select.jsx';

export default function ModelSelectionSection({ config, setConfig, processing }) {
  return (
    <>
      <label
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
      </label>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(1, 1fr)',
          gap: 'var(--aparture-space-4)',
        }}
        className="md:grid-cols-3"
      >
        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            Quick Filter Model
          </label>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: '11px',
              color: 'var(--aparture-mute)',
              margin: '0 0 8px 0',
              lineHeight: 1.5,
            }}
          >
            Triages each paper as YES / MAYBE / NO based on your profile. Processes papers in small
            batches (configurable under Advanced Options) so even lightweight models work well here.
          </p>
          <Select
            value={config.filterModel}
            onChange={(e) => setConfig((prev) => ({ ...prev, filterModel: e.target.value }))}
            disabled={processing.isRunning}
          >
            {AVAILABLE_MODELS.map((model) => (
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
              {getModel(config.filterModel)?.description}
            </p>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            Abstract Scoring Model
          </label>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: '11px',
              color: 'var(--aparture-mute)',
              margin: '0 0 8px 0',
              lineHeight: 1.5,
            }}
          >
            Reads each abstract and scores relevance 0–10 with a justification. This is where your
            profile has the most influence on paper ranking.
          </p>
          <Select
            value={config.scoringModel}
            onChange={(e) => setConfig((prev) => ({ ...prev, scoringModel: e.target.value }))}
            disabled={processing.isRunning}
          >
            {AVAILABLE_MODELS.map((model) => (
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
              {getModel(config.scoringModel)?.description}
            </p>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            Deep PDF Analysis Model
          </label>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: '11px',
              color: 'var(--aparture-mute)',
              margin: '0 0 8px 0',
              lineHeight: 1.5,
            }}
          >
            Downloads and analyzes the full PDF for top-ranked papers. Produces detailed summaries,
            key findings, and methodology assessments. Benefits from a capable model.
          </p>
          <Select
            value={config.pdfModel}
            onChange={(e) => setConfig((prev) => ({ ...prev, pdfModel: e.target.value }))}
            disabled={processing.isRunning}
          >
            {getModelsForPDF().map((model) => (
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
              {getModel(config.pdfModel)?.description}
            </p>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            Quick-Summary Model (briefing prep)
          </label>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: '11px',
              color: 'var(--aparture-mute)',
              margin: '0 0 8px 0',
              lineHeight: 1.5,
            }}
          >
            Compresses each analyzed PDF into a ~300-word pre-read before briefing synthesis.
            Independent of the briefing model — lightweight models work well here.
          </p>
          <Select
            value={config.quickSummaryModel ?? 'gemini-3.1-flash-lite'}
            onChange={(e) => setConfig((prev) => ({ ...prev, quickSummaryModel: e.target.value }))}
            disabled={processing.isRunning}
          >
            {AVAILABLE_MODELS.map((model) => (
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
              {getModel(config.quickSummaryModel ?? 'gemini-3.1-flash-lite')?.description}
            </p>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            Briefing Model (synthesis + suggest)
          </label>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: '11px',
              color: 'var(--aparture-mute)',
              margin: '0 0 8px 0',
              lineHeight: 1.5,
            }}
          >
            Synthesizes the analyzed papers into a structured briefing, and also powers the Suggest
            Improvements flow on the Profile page.
          </p>
          <Select
            value={config.briefingModel ?? config.pdfModel}
            onChange={(e) => setConfig((prev) => ({ ...prev, briefingModel: e.target.value }))}
            disabled={processing.isRunning}
          >
            {getModelsForPDF().map((model) => (
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
              {getModel(config.briefingModel ?? config.pdfModel)?.description}
            </p>
          </div>
        </div>
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
