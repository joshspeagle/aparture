import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { applyCap } from '../../lib/profile/feedbackCap.js';

function iconForType(type) {
  if (type === 'star') return '★';
  if (type === 'dismiss') return '⊘';
  if (type === 'paper-comment') return '💬';
  if (type === 'general-comment') return '💭';
  return '·';
}

function FeedbackRow({ event, checked, onToggle }) {
  const icon = iconForType(event.type);
  const dateStr = new Date(event.timestamp).toLocaleDateString();
  const label =
    event.type === 'general-comment'
      ? event.text
      : `${event.arxivId}${event.paperTitle ? ` · ${event.paperTitle}` : ''}`;
  return (
    <label className="flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-800/40 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <span>{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <div className="text-[10px] text-slate-500">{dateStr}</div>
      </div>
    </label>
  );
}

export default function SuggestDialog({
  isOpen,
  onClose,
  // eslint-disable-next-line no-unused-vars
  profile,
  newFeedback,
  cap,
  briefingModel,
  // eslint-disable-next-line no-unused-vars
  provider,
  // eslint-disable-next-line no-unused-vars
  password,
  // eslint-disable-next-line no-unused-vars
  onAccept,
}) {
  // Signature of the current newFeedback — when it changes, we reset local state
  // during render rather than in an effect (avoids cascading renders).
  const feedbackSignature = useMemo(() => newFeedback.map((e) => e.id).join('|'), [newFeedback]);
  const [lastSignature, setLastSignature] = useState(feedbackSignature);
  const [selectedIds, setSelectedIds] = useState(() => new Set(newFeedback.map((e) => e.id)));
  const [state, setState] = useState('selection');
  // eslint-disable-next-line no-unused-vars
  const [response, setResponse] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);

  if (feedbackSignature !== lastSignature) {
    setLastSignature(feedbackSignature);
    setSelectedIds(new Set(newFeedback.map((e) => e.id)));
    setState('selection');
    setResponse(null);
    setError(null);
  }

  const capStats = useMemo(() => applyCap(newFeedback, cap).stats, [newFeedback, cap]);
  const droppedCount =
    capStats.paperCommentTotal +
    capStats.generalCommentTotal -
    capStats.paperCommentKept -
    capStats.generalCommentKept;

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasFeedback = newFeedback.length > 0;
  const hasSelection = selectedIds.size > 0;
  const canGenerate = hasFeedback && hasSelection;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-slate-900 shadow-xl flex flex-col">
          <div className="p-5 border-b border-slate-800">
            <Dialog.Title className="text-lg font-semibold text-slate-100">
              Suggest profile improvements
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-slate-400">
              Select which feedback events should inform the suggestion. All are included by default
              — uncheck any you want to exclude.
            </Dialog.Description>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {state === 'selection' && (
              <>
                {capStats.trimmed && (
                  <div className="rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                    {droppedCount} older comments will not be included in this suggestion. Visit the
                    Feedback panel to curate manually.
                  </div>
                )}

                {!hasFeedback ? (
                  <p className="text-sm text-slate-400">
                    No new feedback since your last profile revision. Nothing to suggest from.
                  </p>
                ) : (
                  <div className="max-h-[40vh] overflow-y-auto rounded border border-slate-800 bg-slate-950/40 p-2">
                    {newFeedback.map((e) => (
                      <FeedbackRow
                        key={e.id}
                        event={e}
                        checked={selectedIds.has(e.id)}
                        onToggle={() => toggle(e.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {state === 'loading' && (
              <div className="py-10 text-center text-sm text-slate-400">
                Asking {briefingModel}…
              </div>
            )}

            {state === 'result' && (
              <div className="py-10 text-center text-sm text-slate-500">
                [Result view — Task 18]
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-600 hover:border-slate-400 text-slate-200 px-4 py-2 rounded-md text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setState('loading')}
              disabled={!canGenerate}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate suggestion
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
