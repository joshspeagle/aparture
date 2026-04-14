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
            borderLeft: '1px solid var(--aparture-hairline)',
            padding: 'var(--aparture-space-8)',
            overflowY: 'auto',
          }}
        >
          <Dialog.Title
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xl)',
            }}
          >
            {title}
          </Dialog.Title>
          <article
            className="briefing-prose"
            style={{ padding: 'var(--aparture-space-6) 0', maxWidth: 'none' }}
          >
            <p>{content}</p>
          </article>
          <Dialog.Close asChild>
            <button type="button" aria-label="close">
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
