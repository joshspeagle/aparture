import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { useState } from 'react';
import ArxivFetchingSection from './sections/ArxivFetchingSection.jsx';
import BriefingOptionsSection from './sections/BriefingOptionsSection.jsx';
import CategoriesSection from './sections/CategoriesSection.jsx';
import FilterOptionsSection from './sections/FilterOptionsSection.jsx';
import ModelSelectionSection from './sections/ModelSelectionSection.jsx';
import PdfAnalysisSection from './sections/PdfAnalysisSection.jsx';
import QueryOptionsSection from './sections/QueryOptionsSection.jsx';
import ReviewConfirmationSection from './sections/ReviewConfirmationSection.jsx';
import ScoringOptionsSection from './sections/ScoringOptionsSection.jsx';

export default function SettingsPanel({ config, setConfig, processing }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div
      style={{
        background: 'var(--aparture-surface)',
        borderRadius: '8px',
        padding: 'var(--aparture-space-6)',
        marginBottom: 'var(--aparture-space-6)',
        border: '1px solid var(--aparture-hairline)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        <Settings
          style={{
            width: '20px',
            height: '20px',
            marginRight: 'var(--aparture-space-2)',
            color: 'var(--aparture-accent)',
          }}
        />
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xl)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
            margin: 0,
          }}
        >
          Configuration
        </h2>
        <div style={{ flex: 1 }} />
        <a
          href="https://joshspeagle.github.io/aparture/using/tuning-the-pipeline"
          target="_blank"
          rel="noreferrer"
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            color: 'var(--aparture-mute)',
            fontSize: 'var(--aparture-text-xs)',
            textDecoration: 'none',
          }}
        >
          docs ↗
        </a>
      </div>

      {/* Pipeline overview */}
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          lineHeight: 1.6,
          color: 'var(--aparture-mute)',
          margin: 0,
          marginBottom: 'var(--aparture-space-6)',
        }}
      >
        Aparture runs papers through a multi-stage pipeline: fetch from arXiv, filter for relevance,
        score abstracts in detail, optionally post-process for consistency, then deep-analyze top
        papers via their full PDFs. Each stage can use a different model — cheaper and faster models
        work well for early filtering, while more capable models shine for deep analysis and
        briefing synthesis.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
        <CategoriesSection config={config} setConfig={setConfig} processing={processing} />

        <div>
          <ModelSelectionSection config={config} setConfig={setConfig} processing={processing} />

          {/* Review & confirmation */}
          <ReviewConfirmationSection
            config={config}
            setConfig={setConfig}
            processing={processing}
          />
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-mute)',
              padding: 0,
            }}
          >
            {showAdvanced ? (
              <ChevronDown style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            ) : (
              <ChevronRight style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            )}
            Advanced Options
          </button>
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: '11px',
              color: 'var(--aparture-mute)',
              margin: 'var(--aparture-space-1) 0 0 0',
              lineHeight: 1.5,
            }}
          >
            Fine-grained control over batch sizes, retry behavior, date range, and post-processing.
          </p>

          {showAdvanced && (
            <div
              style={{
                marginTop: 'var(--aparture-space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--aparture-space-4)',
                paddingLeft: 'var(--aparture-space-4)',
                borderLeft: '2px solid var(--aparture-hairline)',
              }}
            >
              <QueryOptionsSection config={config} setConfig={setConfig} processing={processing} />

              <ArxivFetchingSection config={config} setConfig={setConfig} processing={processing} />

              <FilterOptionsSection config={config} setConfig={setConfig} processing={processing} />

              <ScoringOptionsSection
                config={config}
                setConfig={setConfig}
                processing={processing}
              />

              <PdfAnalysisSection config={config} setConfig={setConfig} processing={processing} />

              <BriefingOptionsSection
                config={config}
                setConfig={setConfig}
                processing={processing}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
