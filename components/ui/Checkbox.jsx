export default function Checkbox({ checked, onChange, label, disabled, className, ...rest }) {
  const labelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
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
      {label && <span>{label}</span>}
    </label>
  );
}
