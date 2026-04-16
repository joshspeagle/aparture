import * as Dialog from '@radix-ui/react-dialog';
import Button from '../ui/Button.jsx';

export default function MigrationNotice({ notice, onDismiss }) {
  if (!notice) return null;

  return (
    <div
      style={{
        marginBottom: 'var(--aparture-space-4)',
        borderRadius: '4px',
        border: '1px solid rgba(217, 119, 6, 0.4)',
        background: 'rgba(120, 53, 15, 0.2)',
        padding: 'var(--aparture-space-4) var(--aparture-space-4)',
        fontSize: 'var(--aparture-text-sm)',
        color: '#fde68a',
      }}
    >
      <p style={{ marginBottom: 'var(--aparture-space-2)' }}>
        Your previous Scoring Criteria was different from your Research Profile. The Profile was
        kept; the Scoring Criteria was archived.
      </p>
      <div style={{ display: 'flex', gap: 'var(--aparture-space-2)' }}>
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button
              type="button"
              style={{
                borderRadius: '4px',
                border: '1px solid rgba(217, 119, 6, 0.6)',
                padding: '4px 12px',
                fontSize: 'var(--aparture-text-xs)',
                color: '#fef3c7',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              View discarded content
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.6)',
              }}
            />
            <Dialog.Content
              style={{
                position: 'fixed',
                left: '50%',
                top: '50%',
                maxHeight: '80vh',
                width: '90vw',
                maxWidth: '42rem',
                transform: 'translate(-50%, -50%)',
                overflow: 'auto',
                borderRadius: '8px',
                background: 'var(--aparture-surface)',
                padding: 'var(--aparture-space-6)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <Dialog.Title
                style={{
                  marginBottom: 'var(--aparture-space-3)',
                  fontSize: 'var(--aparture-text-lg)',
                  fontWeight: 600,
                  fontFamily: 'var(--aparture-font-sans)',
                  color: 'var(--aparture-ink)',
                }}
              >
                Discarded Scoring Criteria
              </Dialog.Title>
              <Dialog.Description
                style={{
                  marginBottom: 'var(--aparture-space-4)',
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                }}
              >
                This content was preserved in localStorage for rollback but is no longer read by the
                pipeline.
              </Dialog.Description>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  borderRadius: '4px',
                  background: 'var(--aparture-bg)',
                  padding: 'var(--aparture-space-4)',
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-ink)',
                }}
              >
                {notice.discardedContent}
              </pre>
              <div
                style={{
                  marginTop: 'var(--aparture-space-4)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Dialog.Close asChild>
                  <Button variant="secondary">Close</Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            borderRadius: '4px',
            border: '1px solid rgba(217, 119, 6, 0.6)',
            padding: '4px 12px',
            fontSize: 'var(--aparture-text-xs)',
            color: '#fef3c7',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
