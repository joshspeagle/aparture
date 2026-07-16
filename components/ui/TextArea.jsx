export default function TextArea({ className, style: overrideStyle, ...rest }) {
  const baseStyle = {
    background: 'var(--aparture-bg)',
    border: '1px solid var(--aparture-hairline)',
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    color: 'var(--aparture-ink)',
    padding: '8px 12px',
    borderRadius: '4px',
    boxSizing: 'border-box',
    width: '100%',
    // No `outline: 'none'` here: the global :focus-visible rule in
    // styles/shell.css provides the keyboard-focus ring.
    resize: 'vertical',
    minHeight: '120px',
  };

  return <textarea style={{ ...baseStyle, ...overrideStyle }} className={className} {...rest} />;
}
