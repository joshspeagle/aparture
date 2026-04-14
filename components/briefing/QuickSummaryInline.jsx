export default function QuickSummaryInline({ open, text }) {
  if (!open) return null;
  return (
    <div
      className="quick-summary-inline"
      style={{
        marginTop: 'var(--aparture-space-4)',
        padding: 'var(--aparture-space-4)',
        borderLeft: '2px solid var(--aparture-hairline)',
      }}
    >
      <p>{text}</p>
    </div>
  );
}
