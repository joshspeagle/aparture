import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import SettingsPanel from '../../components/settings/SettingsPanel.jsx';

// Stateful harness so setConfig actually updates the rendered config.
// This is required to test controlled checkbox behavior end-to-end.
function Harness({ initialConfig, processing }) {
  const [config, setConfig] = useState(initialConfig);
  return <SettingsPanel config={config} setConfig={setConfig} processing={processing} />;
}

function defaultProps(overrides = {}) {
  return {
    config: {
      selectedCategories: ['cs.AI'],
      scoringCriteria: '',
      maxDeepAnalysis: 30,
      finalOutputCount: 30,
      daysBack: 1,
      batchSize: 3,
      maxCorrections: 1,
      maxRetries: 4,
      useQuickFilter: true,
      filterModel: 'gemini-3.1-flash-lite',
      filterBatchSize: 3,
      filterConcurrency: 3,
      categoriesToScore: ['YES', 'MAYBE'],
      scoringModel: 'gemini-3-flash',
      scoringBatchSize: 3,
      scoringConcurrency: 3,
      enableScorePostProcessing: true,
      postProcessingCount: 50,
      postProcessingBatchSize: 5,
      postProcessingModel: 'gemini-3-flash',
      postProcessingConcurrency: 3,
      pdfModel: 'gemini-3.1-pro',
      pdfAnalysisConcurrency: 3,
      briefingModel: 'gemini-3.1-pro',
      quickSummaryModel: 'gemini-3.1-flash-lite',
      quickSummaryConcurrency: 5,
      pauseAfterFilter: true,
      pauseBeforeBriefing: true,
      briefingRetryOnYes: true,
      briefingRetryOnMaybe: false,
      maxAbstractDisplay: 500,
      arxivIngestion: 'auto',
      minPapersPerSubcategory: 5,
      lookbackExtensions: [3, 7, 14],
      arxivCacheTtlMinutes: 60,
      arxivWindowSemantics: 'submitted-only',
      removeDuplicates: true,
      ...(overrides.config ?? {}),
    },
    setConfig: vi.fn(),
    processing: { isRunning: false, ...(overrides.processing ?? {}) },
  };
}

// The "Remove duplicate papers" toggle lives inside the Advanced Options
// section, which is collapsed by default. This helper clicks "Advanced Options"
// to expand it before running assertions.
function expandAdvanced() {
  fireEvent.click(screen.getByText('Advanced Options'));
}

describe('SettingsPanel — Remove duplicate papers toggle', () => {
  it('renders the "Remove duplicate papers" label after expanding Advanced Options', () => {
    render(<SettingsPanel {...defaultProps()} />);
    expandAdvanced();
    expect(screen.getByText('Remove duplicate papers')).toBeInTheDocument();
  });

  it('renders a descriptive helper text about the 90-day window', () => {
    render(<SettingsPanel {...defaultProps()} />);
    expandAdvanced();
    // The description mentions "last 90 days" and the badge fallback behavior.
    expect(screen.getByText(/last 90 days/i)).toBeInTheDocument();
  });

  it('checkbox is checked when config.removeDuplicates is true', () => {
    render(<SettingsPanel {...defaultProps()} />);
    expandAdvanced();
    // The text "Remove duplicate papers" is in a <span> inside the <label>.
    // closest('label') walks up to the wrapping label element.
    const textSpan = screen.getByText('Remove duplicate papers');
    const labelEl = textSpan.closest('label');
    expect(labelEl).not.toBeNull();
    const checkbox = labelEl.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);
  });

  it('checkbox is unchecked when config.removeDuplicates is false', () => {
    render(<SettingsPanel {...defaultProps({ config: { removeDuplicates: false } })} />);
    expandAdvanced();
    const textSpan = screen.getByText('Remove duplicate papers');
    const labelEl = textSpan.closest('label');
    const checkbox = labelEl.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(false);
  });

  it('clicking the checkbox toggles removeDuplicates from true to false', () => {
    // Use the stateful Harness so the controlled checkbox actually reflects
    // the new state after setConfig runs, making the toggle observable.
    const props = defaultProps();
    render(<Harness initialConfig={props.config} processing={props.processing} />);
    expandAdvanced();
    const textSpan = screen.getByText('Remove duplicate papers');
    const labelEl = textSpan.closest('label');
    const checkbox = labelEl.querySelector('input[type="checkbox"]');

    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('checkbox is disabled while processing.isRunning is true', () => {
    render(<SettingsPanel {...defaultProps({ processing: { isRunning: true } })} />);
    expandAdvanced();
    const textSpan = screen.getByText('Remove duplicate papers');
    const labelEl = textSpan.closest('label');
    const checkbox = labelEl.querySelector('input[type="checkbox"]');
    expect(checkbox.disabled).toBe(true);
  });
});
