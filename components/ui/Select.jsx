const CHEVRON_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%236b6862' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export default function Select({ className, children, ...rest }) {
  const style = {
    background: 'var(--aparture-bg)',
    border: '1px solid var(--aparture-hairline)',
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    color: 'var(--aparture-ink)',
    padding: '8px 12px',
    paddingRight: '36px',
    borderRadius: '4px',
    boxSizing: 'border-box',
    width: '100%',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("${CHEVRON_SVG}")`,
    backgroundPosition: 'right 12px center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <select style={style} className={className} {...rest}>
      {children}
    </select>
  );
}
