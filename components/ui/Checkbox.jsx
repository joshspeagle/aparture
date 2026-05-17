export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  ...rest
}) {
  const labelStyle = {
    display: 'inline-flex',
    alignItems: description ? 'flex-start' : 'center',
    gap: '8px',
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    color: disabled ? 'var(--aparture-mute)' : 'var(--aparture-ink)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  const inputStyle = {
    accentColor: 'var(--aparture-accent)',
    width: '16px',
    height: '16px',
    margin: 0,
    marginTop: description ? '2px' : 0,
    flexShrink: description ? 0 : undefined,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  return (
    <label style={labelStyle} className={className} {...rest}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={inputStyle}
      />
      {label &&
        (description ? (
          <span>
            <span>{label}</span>
            <span
              style={{
                display: 'block',
                marginTop: '2px',
                color: 'var(--aparture-mute)',
                fontSize: 'var(--aparture-text-xs)',
              }}
            >
              {description}
            </span>
          </span>
        ) : (
          <span>{label}</span>
        ))}
    </label>
  );
}
