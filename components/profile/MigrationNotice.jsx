import * as Dialog from '@radix-ui/react-dialog';

export default function MigrationNotice({ notice, onDismiss }) {
  if (!notice) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
      <p className="mb-2">
        Your previous Scoring Criteria was different from your Research Profile. The Profile was
        kept; the Scoring Criteria was archived.
      </p>
      <div className="flex gap-2">
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="rounded border border-amber-600/60 px-3 py-1 text-xs text-amber-100 hover:bg-amber-800/30"
            >
              View discarded content
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60" />
            <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-slate-900 p-6 shadow-xl">
              <Dialog.Title className="mb-3 text-lg font-semibold text-slate-100">
                Discarded Scoring Criteria
              </Dialog.Title>
              <Dialog.Description className="mb-4 text-xs text-slate-400">
                This content was preserved in localStorage for rollback but is no longer read by the
                pipeline.
              </Dialog.Description>
              <pre className="whitespace-pre-wrap rounded bg-slate-950 p-4 text-xs text-slate-200">
                {notice.discardedContent}
              </pre>
              <div className="mt-4 flex justify-end">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:border-slate-400"
                  >
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded border border-amber-600/60 px-3 py-1 text-xs text-amber-100 hover:bg-amber-800/30"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
