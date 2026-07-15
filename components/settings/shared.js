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
