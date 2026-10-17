// One automatic proposal round after a briefing: check the gate, ask
// suggest-profile, and keep what it proposes for the reader. Nothing about
// the profile changes here; the reader reviews the proposals in the Suggest
// dialog. Kept out of App so it can be tested without rendering the shell.

import { MODEL_REGISTRY, DEFAULT_MODEL_ID } from '../../utils/models.js';
import { proposalGate } from './autoProposals.js';
import { hasProposals, requestSuggestion } from './requestSuggestion.js';

export const PROPOSAL_COMMENT_CAP = { commentCap: 30 };

/**
 * @returns {Promise<{ran: boolean, found?: boolean, reason: string}>}
 */
export async function runProposalRound({
  pendingFeedback,
  autoProposals,
  profile,
  config,
  briefingHistory,
  password,
  briefingDate,
  addStatus = () => {},
  now = Date.now,
  fetchImpl,
}) {
  const gate = proposalGate(pendingFeedback, {
    evaluatedIds: autoProposals.evaluatedIds,
    hasPendingProposal: Boolean(autoProposals.pending),
  });
  if (!gate.run) return { ran: false, reason: gate.reason };
  addStatus(`Preparing profile proposals (${gate.reason})…`);
  const briefingModel = config?.briefingModel ?? config?.pdfModel ?? DEFAULT_MODEL_ID;
  const { response, sentEvents } = await requestSuggestion({
    profile: profile?.content ?? '',
    notes: profile?.notes ?? [],
    events: gate.events,
    cap: PROPOSAL_COMMENT_CAP,
    rejectedSuggestions: profile?.rejectedSuggestions ?? [],
    briefingHistory,
    briefingModel,
    provider: (MODEL_REGISTRY[briefingModel]?.provider ?? 'Google').toLowerCase(),
    password,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  const found = hasProposals(response);
  autoProposals.recordRound({
    pending: found ? { response, sentEvents, createdAt: now(), briefingDate } : null,
    evaluatedIds: sentEvents.map((e) => e.id),
  });
  addStatus(
    found
      ? '✓ Profile proposals ready for review.'
      : 'No profile changes proposed from the recent feedback.'
  );
  return { ran: true, found, reason: gate.reason };
}
