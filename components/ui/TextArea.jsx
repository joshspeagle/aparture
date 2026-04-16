export default function TextArea({ className, ...rest }) {
  const style = {
    background: 'var(--aparture-bg)',
    border: '1px solid var(--aparture-hairline)',
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    color: 'var(--aparture-ink)',
    padding: '8px 12px',
    borderRadius: '4px',
    boxSizing: 'border-box',
    width: '100%',
    outline: 'none',
    resize: 'vertical',
    minHeight: '120px',
  };

  return <textarea style={style} className={className} {...rest} />;
}
