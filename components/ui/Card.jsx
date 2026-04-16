export default function Card({ className, children, style: overrideStyle, ...rest }) {
  const baseStyle = {
    background: 'var(--aparture-surface)',
    border: '1px solid var(--aparture-hairline)',
    padding: 'var(--aparture-space-6)',
    borderRadius: '4px',
  };

  return (
    <div style={{ ...baseStyle, ...overrideStyle }} className={className} {...rest}>
      {children}
    </div>
  );
}
