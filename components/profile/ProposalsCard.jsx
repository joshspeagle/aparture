import Button from '../ui/Button.jsx';

// Shown under the briefing when the editor has prepared profile proposals
// from recent feedback (lib/profile/runProposalRound.js). Nothing changes
// until the reader reviews them; "Review" opens the Suggest dialog at its
// review step.
export default function ProposalsCard({ pending, onReview }) {
  const count =
    (pending?.response?.changes?.length ?? 0) + (pending?.response?.noteChanges?.length ?? 0);
  if (!count) return null;
  const events = pending.sentEvents?.length ?? 0;
  return (
    <section
      aria-labelledby="proposals-card-title"
      style={{
        margin: 'var(--aparture-space-6) auto 0',
        maxWidth: '44rem',
        padding: 'var(--aparture-space-4) var(--aparture-space-6)',
        background: 'var(--aparture-surface)',
        border: '1px solid var(--aparture-hairline)',
        borderLeft: '3px solid #3b82f6',
        borderRadius: '4px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--aparture-space-3)',
      }}
    >
      <div style={{ minWidth: 0, flex: '1 1 20rem' }}>
        <h3
          id="proposals-card-title"
          style={{
            margin: 0,
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
          }}
        >
          {count} proposed {count === 1 ? 'change' : 'changes'} to your profile
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
          }}
        >
          From {events} piece{events === 1 ? '' : 's'} of recent feedback. Nothing changes until you
          accept.
        </p>
      </div>
      <Button variant="primary" onClick={onReview}>
        Review proposals
      </Button>
    </section>
  );
}
