// One suggest-profile request, shared by the Suggest dialog and the
// automatic round after a briefing, so both send the same thing: the
// comment-capped feedback, the recent rejections, the briefings that
// general comments were written against, the profile and its notes.

import { applyCap } from './feedbackCap.js';
import { rejectedSuggestionPromptItems } from './suggestOutcome.js';

// Only the editorial layer (executive summary, themes, paper pitches) of
// each briefing a general comment was written against, not full reports.
export function collectBriefingsForGeneralComments(events, briefingHistory) {
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

// Note changes get their own id space so they can share DiffPreview's
// accept set with the profile changes.
export function normalizeSuggestionResponse(data) {
  return {
    ...data,
    changes: Array.isArray(data?.changes) ? data.changes : [],
    noteChanges: (data?.noteChanges ?? []).map((c) => ({
      id: `note:${c.id}`,
      rationale: c.rationale,
      noteId: c.noteId ?? null,
      note: { action: c.action, scope: c.scope ?? null, text: c.text ?? null },
      source: c,
    })),
  };
}

export function hasProposals(response) {
  return (response?.changes?.length ?? 0) + (response?.noteChanges?.length ?? 0) > 0;
}

/**
 * @returns {Promise<{response: object, sentEvents: object[]}>} the normalized
 *   response and the events actually sent (attribution on Apply uses only
 *   these). Throws with the route's message on a failed request.
 */
export async function requestSuggestion({
  profile,
  notes = [],
  events,
  cap,
  rejectedSuggestions = [],
  briefingHistory = [],
  guidance = '',
  briefingModel,
  provider,
  password,
  signal,
  fetchImpl = fetch,
}) {
  const sentEvents = applyCap(events, cap).kept;
  const res = await fetchImpl('/api/suggest-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentProfile: profile,
      currentNotes: notes,
      // Rejections ride after the capped events; the prompt renders them in
      // their own "previously rejected" section (suggestPrompt.js).
      feedback: [...sentEvents, ...rejectedSuggestionPromptItems(rejectedSuggestions)],
      briefings: collectBriefingsForGeneralComments(sentEvents, briefingHistory),
      guidance: guidance.trim() || undefined,
      briefingModel,
      provider,
      password,
    }),
    signal,
  });
  if (!res.ok) {
    // Surface the route's structured details (e.g. a provider rate-limit
    // message) instead of the bare HTTP code.
    let message = `Suggestion failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body?.details || body?.error || message;
    } catch {
      // body wasn't JSON; keep the status-based message
    }
    throw new Error(message);
  }
  return { response: normalizeSuggestionResponse(await res.json()), sentEvents };
}
