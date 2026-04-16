export default function Button({
  variant = 'secondary',
  disabled,
  className,
  children,
  type = 'button',
  style: overrideStyle,
  ...rest
}) {
  const base = {
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 150ms ease',
    padding: '8px 16px',
    lineHeight: 1.4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  };

  const variants = {
    primary: {
      background: 'var(--aparture-accent)',
      color: '#fff',
      border: '1px solid var(--aparture-accent)',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--aparture-ink)',
      border: '1px solid var(--aparture-hairline)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--aparture-mute)',
      borderStyle: 'none',
      borderWidth: 0,
      padding: '8px 12px',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...overrideStyle }}
      className={className}
      {...rest}
    >
      {children}
    </button>
  );
}
