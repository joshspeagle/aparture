import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { applyCap } from '../../lib/profile/feedbackCap.js';
import { iconFor } from '../feedback/eventMeta.js';
import DiffPreview from './DiffPreview.jsx';

function FeedbackRow({ event, checked, onToggle }) {
  const icon = iconFor(event.type);
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
  profile,
  newFeedback,
  cap,
  briefingModel,
  provider,
  password,
  onAccept,
}) {
  // Signature of the current newFeedback — when it changes, we reset local state
  // during render rather than in an effect (avoids cascading renders).
  const feedbackSignature = useMemo(() => newFeedback.map((e) => e.id).join('|'), [newFeedback]);
  const [lastSignature, setLastSignature] = useState(feedbackSignature);
  const [selectedIds, setSelectedIds] = useState(() => new Set(newFeedback.map((e) => e.id)));
  const [state, setState] = useState('selection');
  const [response, setResponse] = useState(null);
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

  async function handleGenerate() {
    setError(null);
    setState('loading');
    try {
      const selectedEvents = newFeedback.filter((e) => selectedIds.has(e.id));
      const res = await fetch('/api/suggest-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentProfile: profile,
          feedback: selectedEvents,
          briefingModel,
          provider,
          password,
        }),
      });
      if (!res.ok) {
        throw new Error(`Suggestion failed: ${res.status}`);
      }
      const data = await res.json();
      setResponse(data);
      setState('result');
    } catch (e) {
      setError(e.message);
      setState('selection');
    }
  }

  // For the result-state "no changes" counts, compute stats over the
  // actually-selected events (after applying the cap).
  const resultStats = useMemo(() => {
    if (state !== 'result' || !response) return null;
    const selectedEvents = newFeedback.filter((e) => selectedIds.has(e.id));
    return applyCap(selectedEvents, cap).stats;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, response]);

  // Compute newCutoff from the events actually sent to the LLM. selectedIds
  // was captured at handleGenerate time and holds the most recent feedback
  // included in this suggestion.
  function computeCutoff() {
    const selectedEvents = newFeedback.filter((e) => selectedIds.has(e.id));
    return selectedEvents.length > 0 ? Math.max(...selectedEvents.map((e) => e.timestamp)) : 0;
  }

  function handleAccept() {
    const joinedRationale = response.changes.map((c) => `• ${c.rationale}`).join('\n');
    onAccept(response.revisedProfile, joinedRationale, computeCutoff());
    onClose();
  }

  function handleNoChangeDismiss() {
    const rationale = `No changes warranted: ${response.noChangeReason}`;
    // Passes the UNCHANGED profile content so saveSuggested creates a
    // revision entry that marks the feedback as reviewed without touching
    // the profile text.
    onAccept(profile, rationale, computeCutoff());
    onClose();
  }

  // result-state discriminant: 'changes' | 'no-change' | null
  const resultMode =
    state === 'result' && response
      ? Array.isArray(response.changes) && response.changes.length > 0
        ? 'changes'
        : 'no-change'
      : null;

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
                {error && (
                  <div className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-200">
                    Suggestion failed: {error}. Retry?
                  </div>
                )}
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
              <div className="py-16 text-center">
                <div className="inline-block animate-pulse text-slate-400 text-sm">
                  Asking {briefingModel}…
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  This typically takes 15–45 seconds depending on the model.
                </div>
              </div>
            )}

            {resultMode === 'changes' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-200">
                    Proposed changes ({response.changes.length})
                  </h3>
                  <div className="text-xs text-slate-500">via {briefingModel}</div>
                </div>
                <DiffPreview
                  before={profile}
                  after={response.revisedProfile}
                  changes={response.changes}
                />
              </div>
            )}

            {resultMode === 'no-change' && (
              <div className="py-8 text-center space-y-3">
                <div className="text-lg text-slate-300">No profile changes suggested</div>
                {response.noChangeReason && (
                  <div className="mx-auto max-w-xl text-sm text-slate-400 italic">
                    &ldquo;{response.noChangeReason}&rdquo;
                  </div>
                )}
                {resultStats && (
                  <div className="text-xs text-slate-500">
                    Reviewed {resultStats.starCount} stars, {resultStats.dismissCount} dismisses,{' '}
                    {resultStats.paperCommentTotal + resultStats.generalCommentTotal} comments — no
                    profile gaps identified.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
            {state === 'selection' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-slate-600 hover:border-slate-400 text-slate-200 px-4 py-2 rounded-md text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate suggestion
                </button>
              </>
            )}

            {state === 'loading' && (
              <button
                type="button"
                onClick={onClose}
                className="border border-slate-600 hover:border-slate-400 text-slate-200 px-4 py-2 rounded-md text-sm"
              >
                Cancel
              </button>
            )}

            {resultMode === 'changes' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-slate-600 hover:border-slate-400 text-slate-200 px-4 py-2 rounded-md text-sm"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Accept
                </button>
              </>
            )}

            {resultMode === 'no-change' && (
              <button
                type="button"
                onClick={handleNoChangeDismiss}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Dismiss
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
