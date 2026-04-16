export default function FeedbackEmptyState() {
  return (
    <div
      style={{
        borderRadius: '4px',
        border: '1px dashed var(--aparture-hairline)',
        background: 'var(--aparture-bg)',
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: 'var(--aparture-mute)',
          fontSize: 'var(--aparture-text-sm)',
          marginBottom: 'var(--aparture-space-2)',
        }}
      >
        Your feedback will appear here as you interact with briefings.
      </div>
      <div
        style={{
          color: 'var(--aparture-mute)',
          opacity: 0.8,
          fontSize: 'var(--aparture-text-xs)',
          lineHeight: 1.6,
          maxWidth: '28rem',
          margin: '0 auto',
        }}
      >
        Click <span style={{ color: '#eab308' }}>★</span> or{' '}
        <span style={{ color: 'var(--aparture-mute)' }}>⊘</span> on papers to record your reactions.
        Add comments to specific papers, or use <em>Add a comment</em> above for general thoughts.
        Your feedback powers the <em>Suggest improvements</em> flow in Your Profile.
      </div>
    </div>
  );
}
