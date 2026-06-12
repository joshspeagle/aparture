import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { applyCap } from '../../lib/profile/feedbackCap.js';
import { iconFor } from '../feedback/eventMeta.js';
import Button from '../ui/Button.jsx';
import TextArea from '../ui/TextArea.jsx';
import DiffPreview from './DiffPreview.jsx';

// Pre-filled into the guidance field when the dialog opens with no feedback.
// Editable — users can trim, replace, or augment before generating. Targets
// the four dimensions that most hurt downstream pipeline stages: vague
// vocabulary, implicit scope, flat priority, methodology/application
// orientation.
const DEFAULT_CLARITY_GUIDANCE =
  'Sharpen the clarity and specificity of my profile. Look for vague terms that could be replaced with concrete methods or subfields, implicit scope boundaries that should be made explicit (what’s in vs. out of scope), priority signals that aren’t yet legible (primary vs. secondary interests), and places where methodology vs. application orientation is ambiguous.';

// Pull out the briefings referenced by general-comment events and return a
// map keyed by briefingId, shaped so the suggest-profile prompt can render
// them inline. We include only the editorial layer (executive summary,
// theme titles + arguments, and per-paper pitches) — not full per-paper
// technical reports or quick summaries, which are noisy and not what the
// user was reacting to.
function collectBriefingsForGeneralComments(events, briefingHistory) {
  if (!Array.isArray(briefingHistory) || briefingHistory.length === 0) return {};
  const referenced = new Set();
  for (const e of events) {
    if (e.type === 'general-comment' && e.briefingId) referenced.add(e.briefingId);
  }
  if (referenced.size === 0) return {};
  const out = {};
  for (const entry of briefingHistory) {
    if (!referenced.has(entry.id)) continue;
    const b = entry.briefing ?? {};
    out[entry.id] = {
      date: entry.date,
      executiveSummary: b.executiveSummary ?? '',
      themes: (b.themes ?? []).map((t) => ({
        title: t.title ?? '',
        argument: t.argument ?? '',
        paperIds: Array.isArray(t.paperIds) ? t.paperIds : [],
      })),
      papers: (b.papers ?? []).map((p) => ({
        arxivId: p.arxivId ?? '',
        title: p.title ?? '',
        onelinePitch: p.onelinePitch ?? '',
      })),
    };
  }
  return out;
}

function scopeKindLabel(scope) {
  if (scope?.kind === 'bucket') return `${scope.bucket} bucket`;
  if (scope?.kind === 'score-review') return 'Score-review note';
  return 'Run note';
}

function makeLabel(event) {
  if (event.type === 'general-comment') return event.text;
  if (event.type === 'scoped-feedback') {
    const excerpt = event.text.length > 60 ? event.text.slice(0, 60) + '\u2026' : event.text;
    return `${scopeKindLabel(event.scope)} \u2014 ${excerpt}`;
  }
  return `${event.arxivId ?? ''}${event.paperTitle ? ` \u00b7 ${event.paperTitle}` : ''}`;
}

function FeedbackRow({ event, checked, onToggle }) {
  const icon = iconFor(event.type);
  const dateStr = new Date(event.timestamp).toLocaleDateString();
  const label = makeLabel(event);
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '4px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--aparture-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ marginTop: '4px', accentColor: 'var(--aparture-accent)' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-ink)',
          }}
        >
          <span>{icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: '10px',
            color: 'var(--aparture-mute)',
          }}
        >
          {dateStr}
        </div>
      </div>
    </label>
  );
}

export default function SuggestDialog({
  isOpen,
  onClose,
  profile,
  newFeedback,
  briefingHistory,
  cap,
  briefingModel,
  provider,
  password,
  onAccept,
}) {
  const feedbackSignature = useMemo(() => newFeedback.map((e) => e.id).join('|'), [newFeedback]);
  const [lastSignature, setLastSignature] = useState(feedbackSignature);
  const [selectedIds, setSelectedIds] = useState(() => new Set(newFeedback.map((e) => e.id)));
  const [guidance, setGuidance] = useState(() =>
    newFeedback.length === 0 ? DEFAULT_CLARITY_GUIDANCE : ''
  );
  const [state, setState] = useState('selection');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  if (feedbackSignature !== lastSignature) {
    setLastSignature(feedbackSignature);
    setSelectedIds(new Set(newFeedback.map((e) => e.id)));
    setGuidance(newFeedback.length === 0 ? DEFAULT_CLARITY_GUIDANCE : '');
    setState('selection');
    setResponse(null);
    setError(null);
  }

  // The dialog is always mounted at the app root, so internal state survives
  // close/reopen. Reset the request-cycle state (but not the user's selection
  // / guidance) whenever the dialog transitions to open, so a stale result or
  // error from a previous session never flashes on reopen.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setState('selection');
      setResponse(null);
      setError(null);
    }
  }

  // Abort any in-flight suggest-profile fetch when the dialog closes (or the
  // component unmounts) — cancelling during loading previously let the fetch
  // resolve in the background and surface its result/error on reopen.
  const abortRef = useRef(null);
  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [isOpen]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    []
  );

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
  const hasGuidance = guidance.trim().length > 0;
  // Generate is allowed when there's *some* input for the LLM: either
  // selected feedback events to react to, or free-form guidance describing
  // the revision. Both empty = no signal, keep disabled.
  const canGenerate = (hasFeedback && hasSelection) || hasGuidance;

  async function handleGenerate() {
    setError(null);
    setState('loading');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const selectedEvents = newFeedback.filter((e) => selectedIds.has(e.id));
      // Apply the SAME comment cap that drives the "N older comments will not
      // be included" notice so the POST body matches what the user is told.
      // applyCap keeps all stars/dismisses/scoped-feedback/filter-overrides and
      // only trims paper/general comments to the most-recent `cap` per type —
      // without this, the trimming notice was display-only and the dropped
      // comments were still sent, inflating token cost.
      const cappedEvents = applyCap(selectedEvents, cap).kept;
      // Collect briefings referenced by general-comment events so the
      // suggest-profile prompt can cite the content the comment was
      // written against. Only include the editorial layer (executive
      // summary, themes, paper pitches) — not full per-paper reports.
      const briefings = collectBriefingsForGeneralComments(cappedEvents, briefingHistory);
      const res = await fetch('/api/suggest-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentProfile: profile,
          feedback: cappedEvents,
          briefings,
          guidance: guidance.trim() || undefined,
          briefingModel,
          provider,
          password,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // Surface the route's structured details (e.g. provider rate-limit
        // message) instead of the bare HTTP code.
        let bodyMsg = `Suggestion failed: ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody?.details) bodyMsg = errBody.details;
          else if (errBody?.error) bodyMsg = errBody.error;
        } catch {
          // body wasn't JSON — keep the status-based message
        }
        throw new Error(bodyMsg);
      }
      const data = await res.json();
      setResponse(data);
      setState('result');
    } catch (e) {
      // Swallow aborts (user closed the dialog mid-request) — the open
      // transition resets state, so surfacing them as errors would only
      // leave a stale banner for the next session.
      if (e.name === 'AbortError') return;
      setError(e.message);
      setState('selection');
    }
  }

  const resultStats = useMemo(() => {
    if (state !== 'result' || !response) return null;
    const selectedEvents = newFeedback.filter((e) => selectedIds.has(e.id));
    return applyCap(selectedEvents, cap).stats;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, response]);

  function computeCutoff() {
    const selectedEvents = newFeedback.filter((e) => selectedIds.has(e.id));
    return selectedEvents.length > 0 ? Math.max(...selectedEvents.map((e) => e.timestamp)) : 0;
  }

  function handleApply({ acceptedIds, resultText }) {
    const acceptedChanges = response.changes.filter((c) => acceptedIds.includes(c.id));
    const joinedRationale = acceptedChanges.map((c) => `\u2022 ${c.rationale}`).join('\n');
    // Log acceptance metadata for future telemetry (no-op when window is absent).
    if (typeof window !== 'undefined' && window.__aparture?.logEvent) {
      try {
        window.__aparture.logEvent('suggest-profile.accepted', {
          totalChanges: response.changes.length,
          acceptedCount: acceptedIds.length,
          acceptedIds,
        });
      } catch {
        // Swallow telemetry errors — never block the apply flow.
      }
    }
    onAccept(resultText, joinedRationale, computeCutoff());
    onClose();
  }

  function handleNoChangeDismiss() {
    const rationale = `No changes warranted: ${response.noChangeReason}`;
    onAccept(profile, rationale, computeCutoff());
    onClose();
  }

  const resultMode =
    state === 'result' && response
      ? Array.isArray(response.changes) && response.changes.length > 0
        ? 'changes'
        : 'no-change'
      : null;

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
  };

  const contentStyle = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    maxHeight: '85vh',
    width: '90vw',
    maxWidth: '48rem',
    transform: 'translate(-50%, -50%)',
    overflow: 'hidden',
    borderRadius: '4px',
    background: 'var(--aparture-surface)',
    border: '1px solid var(--aparture-hairline)',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={contentStyle}>
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid var(--aparture-hairline)',
            }}
          >
            <Dialog.Title
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-lg)',
                fontWeight: 600,
                color: 'var(--aparture-ink)',
              }}
            >
              Suggest profile improvements
            </Dialog.Title>
            <Dialog.Description
              style={{
                marginTop: '4px',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
              }}
            >
              Select which feedback events should inform the suggestion. All are included by default
              — uncheck any you want to exclude.
            </Dialog.Description>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--aparture-space-3)',
            }}
          >
            {state === 'selection' && (
              <>
                {error && (
                  <div
                    style={{
                      borderRadius: '4px',
                      border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.08)',
                      padding: '8px 12px',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: '#ef4444',
                    }}
                  >
                    Suggestion failed: {error}. Retry?
                  </div>
                )}
                {capStats.trimmed && (
                  <div
                    style={{
                      borderRadius: '4px',
                      border: '1px solid rgba(245,158,11,0.3)',
                      background: 'rgba(245,158,11,0.08)',
                      padding: '8px 12px',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: '#f59e0b',
                    }}
                  >
                    {droppedCount} older comments will not be included in this suggestion. Visit the
                    Feedback panel to curate manually.
                  </div>
                )}

                {hasFeedback ? (
                  <div
                    style={{
                      maxHeight: '40vh',
                      overflowY: 'auto',
                      borderRadius: '4px',
                      border: '1px solid var(--aparture-hairline)',
                      background: 'var(--aparture-bg)',
                      padding: '8px',
                    }}
                  >
                    {newFeedback.map((e) => (
                      <FeedbackRow
                        key={e.id}
                        event={e}
                        checked={selectedIds.has(e.id)}
                        onToggle={() => toggle(e.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-sm)',
                      color: 'var(--aparture-mute)',
                      margin: 0,
                    }}
                  >
                    No recent feedback — describe below what you&apos;d like changed and the LLM
                    will revise your profile from guidance alone.
                  </p>
                )}

                <div style={{ marginTop: 'var(--aparture-space-4)' }}>
                  <label
                    htmlFor="suggest-guidance"
                    style={{
                      display: 'block',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-sm)',
                      fontWeight: 600,
                      color: 'var(--aparture-ink)',
                      marginBottom: '4px',
                    }}
                  >
                    Guidance for this suggestion{' '}
                    <span
                      style={{
                        fontWeight: 400,
                        color: 'var(--aparture-mute)',
                      }}
                    >
                      {hasFeedback ? '(optional)' : '(required without feedback)'}
                    </span>
                  </label>
                  <TextArea
                    id="suggest-guidance"
                    rows={3}
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                    placeholder='e.g. "focus on narrowing my interests to galactic dynamics" or "keep the NLP language, drop vision-only work"'
                  />
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: 'var(--aparture-mute)',
                      lineHeight: 1.5,
                    }}
                  >
                    A short, direct note about how you want the profile to change. Applies to this
                    suggestion only; not stored as feedback.
                  </p>
                </div>
              </>
            )}

            {state === 'loading' && (
              <div
                style={{
                  padding: 'var(--aparture-space-16) 0',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-sm)',
                    color: 'var(--aparture-mute)',
                  }}
                >
                  Asking {briefingModel}...
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-mute)',
                  }}
                >
                  This typically takes 15-45 seconds depending on the model.
                </div>
              </div>
            )}

            {resultMode === 'changes' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-3)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-sm)',
                      fontWeight: 500,
                      color: 'var(--aparture-ink)',
                    }}
                  >
                    Proposed changes ({response.changes.length})
                  </h3>
                  <div
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: 'var(--aparture-mute)',
                    }}
                  >
                    via {briefingModel}
                  </div>
                </div>
                <DiffPreview
                  currentProfile={profile}
                  changes={response.changes}
                  onApply={handleApply}
                  onCancel={onClose}
                />
              </div>
            )}

            {resultMode === 'no-change' && (
              <div
                style={{
                  padding: 'var(--aparture-space-8) 0',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--aparture-space-3)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-lg)',
                    color: 'var(--aparture-ink)',
                  }}
                >
                  No profile changes suggested
                </div>
                {response.noChangeReason && (
                  <div
                    style={{
                      margin: '0 auto',
                      maxWidth: '32rem',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-sm)',
                      color: 'var(--aparture-mute)',
                      fontStyle: 'italic',
                    }}
                  >
                    &ldquo;{response.noChangeReason}&rdquo;
                  </div>
                )}
                {resultStats && (
                  <div
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      color: 'var(--aparture-mute)',
                    }}
                  >
                    Based on {resultStats.starCount} stars, {resultStats.dismissCount} dismisses,{' '}
                    {resultStats.paperCommentKept} of {resultStats.paperCommentTotal} paper
                    comments, {resultStats.generalCommentKept} of {resultStats.generalCommentTotal}{' '}
                    general comments
                    {resultStats.scopedFeedback > 0
                      ? `, ${resultStats.scopedFeedback} scoped-feedback notes`
                      : ''}
                    {resultStats.filterOverride > 0
                      ? `, ${resultStats.filterOverride} filter overrides`
                      : ''}{' '}
                    — no profile gaps identified.
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              padding: '20px',
              borderTop: '1px solid var(--aparture-hairline)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            {state === 'selection' && (
              <>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
                  Generate suggestion
                </Button>
              </>
            )}

            {state === 'loading' && (
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            )}

            {resultMode === 'changes' && null}

            {resultMode === 'no-change' && (
              <Button variant="primary" onClick={handleNoChangeDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
