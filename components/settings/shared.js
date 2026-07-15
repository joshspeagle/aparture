// Shared inline styles for the settings sections. Substituted only where the
// per-site literals were byte-identical — a section that deliberately drifts
// (extra margin, different weight) keeps its own literal.
export const SECTION_TITLE_STYLE = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  fontWeight: 600,
  color: 'var(--aparture-mute)',
  marginBottom: 'var(--aparture-space-2)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export const FIELD_LABEL_STYLE = {
  display: 'block',
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-sm)',
  fontWeight: 500,
  color: 'var(--aparture-mute)',
  marginBottom: '4px',
};

export const HELP_TEXT_STYLE = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  color: 'var(--aparture-mute)',
  marginTop: '4px',
};

// Helper for integer inputs: freeform typing with range clamping on blur.
// Removes the browser spinner arrows that type="number" shows.
// Factory form so each section component can bind it to the panel's
// config/setConfig/processing props.
export const integerInputPropsFor =
  ({ config, setConfig, processing }) =>
  (configKey, defaultVal, min, max) => ({
    type: 'text',
    inputMode: 'numeric',
    value: config[configKey] ?? defaultVal,
    onChange: (e) => {
      const raw = e.target.value;
      // Allow empty + digits while typing; parseInt on blur does the real validation
      if (raw === '' || /^\d+$/.test(raw)) {
        setConfig((prev) => ({ ...prev, [configKey]: raw === '' ? '' : parseInt(raw, 10) }));
      }
    },
    onBlur: (e) => {
      const parsed = parseInt(e.target.value, 10);
      const clamped = Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : defaultVal;
      setConfig((prev) => ({ ...prev, [configKey]: clamped }));
    },
    disabled: processing.isRunning,
  });
