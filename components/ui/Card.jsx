export default function Card({ className, children, ...rest }) {
  const style = {
    background: 'var(--aparture-surface)',
    border: '1px solid var(--aparture-hairline)',
    padding: 'var(--aparture-space-6)',
    borderRadius: '4px',
  };

  return (
    <div style={style} className={className} {...rest}>
      {children}
    </div>
  );
}
