import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScoringOptionsSection from '../../components/settings/sections/ScoringOptionsSection.jsx';
import { AVAILABLE_MODELS } from '../../utils/models.js';

const baseConfig = {
  scoringBatchSize: 3,
  scoringConcurrency: 3,
  enableScorePostProcessing: true,
  postProcessingBatchSize: 5,
  postProcessingConcurrency: 3,
  postProcessingCount: 50,
  scoringModel: 'gemini-3.6-flash',
  postProcessingModel: 'gemini-3.6-flash',
};

const renderSection = (config = baseConfig) => {
  const setConfig = vi.fn();
  render(
    <ScoringOptionsSection
      config={config}
      setConfig={setConfig}
      processing={{ isRunning: false }}
    />
  );
  return setConfig;
};

describe('ScoringOptionsSection', () => {
  it('labels its fields, so screen readers name each input', () => {
    renderSection();
    expect(screen.getByLabelText('Scoring Batch Size')).toHaveValue('3');
    expect(screen.getByLabelText('Papers to Review')).toHaveValue('50');
  });

  // Stage 3.5 had no model control: a setup with only a Claude or GPT key
  // could not move it off its Gemini default.
  it('lets the reader pick the post-processing model', () => {
    const setConfig = renderSection();
    const claude = AVAILABLE_MODELS.find((m) => m.id.startsWith('claude-'));
    fireEvent.change(screen.getByLabelText('Review Model'), { target: { value: claude.id } });
    const updater = setConfig.mock.calls.at(-1)[0];
    expect(updater(baseConfig).postProcessingModel).toBe(claude.id);
  });

  it('hides the picker while post-processing is off', () => {
    renderSection({ ...baseConfig, enableScorePostProcessing: false });
    expect(screen.queryByLabelText('Review Model')).toBeNull();
  });
});
