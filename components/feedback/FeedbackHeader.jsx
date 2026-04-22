import Button from '../ui/Button.jsx';

export default function FeedbackHeader({ newCount, totalCount, onSuggestClick }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--aparture-space-4)',
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-base)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
            margin: 0,
          }}
        >
          Feedback
        </h2>
        <p
          style={{
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            marginTop: '2px',
          }}
        >
          {newCount} new since last revision · {totalCount} total
        </p>
      </div>
      <Button variant="primary" onClick={onSuggestClick}>
        Suggest improvements
      </Button>
    </header>
  );
}
