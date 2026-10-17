import * as Dialog from '@radix-ui/react-dialog';
import MarkdownLite from './MarkdownLite.jsx';

// Above the mobile top bar (30), drawer scrim (40) and drawer (50).
const LAYER = 60;

export default function FullReportSidePanel({ open, onOpenChange, title, content }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.15)',
            zIndex: LAYER,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="sheet-on-mobile"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '55%',
            background: 'var(--aparture-bg)',
            color: 'var(--aparture-ink)',
            borderLeft: '1px solid var(--aparture-hairline)',
            overflowY: 'auto',
            zIndex: LAYER,
          }}
        >
          {/* Close stays in reach while a long report scrolls: on a phone
              the panel fills the screen, so there is no overlay to tap. */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 'var(--aparture-space-4)',
              padding: 'var(--aparture-space-6) var(--aparture-space-8) var(--aparture-space-4)',
              background: 'var(--aparture-bg)',
              borderBottom: '1px solid var(--aparture-hairline)',
            }}
          >
            <Dialog.Title
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xl)',
                fontWeight: 600,
                color: 'var(--aparture-ink)',
                margin: 0,
                minWidth: 0,
              }}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="touch-target"
                style={{
                  flexShrink: 0,
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
          </div>
          <article
            className="briefing-prose"
            style={{
              padding: 'var(--aparture-space-6) var(--aparture-space-8)',
              maxWidth: 'none',
            }}
          >
            {/* The report is Markdown ("## Summary" sections from
                composeFullReport); render its structure instead of printing
                the raw syntax. React elements only — no HTML injection. */}
            <MarkdownLite text={content} />
          </article>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
