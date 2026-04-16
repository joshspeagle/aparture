import * as Dialog from '@radix-ui/react-dialog';

export default function FullReportSidePanel({ open, onOpenChange, title, content }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.15)',
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '55%',
            background: 'var(--aparture-bg)',
            color: 'var(--aparture-ink)',
            borderLeft: '1px solid var(--aparture-hairline)',
            padding: 'var(--aparture-space-8)',
            overflowY: 'auto',
          }}
        >
          <Dialog.Title
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xl)',
              fontWeight: 600,
              color: 'var(--aparture-ink)',
              margin: 0,
            }}
          >
            {title}
          </Dialog.Title>
          <article
            className="briefing-prose"
            style={{ padding: 'var(--aparture-space-6) 0', maxWidth: 'none' }}
          >
            {String(content ?? '')
              .split('\n\n')
              .map((para, i) => (
                <p key={i}>{para}</p>
              ))}
          </article>
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="close"
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                padding: 'var(--aparture-space-2) var(--aparture-space-4)',
                background: 'var(--aparture-surface)',
                color: 'var(--aparture-ink)',
                border: '1px solid var(--aparture-hairline)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
