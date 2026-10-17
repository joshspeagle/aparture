// Decides which feedback events a profile suggestion actually used, once the
// user has accepted or rejected its changes in the Suggest dialog.
//
// Only events behind an ACCEPTED change count as incorporated. Everything
// else — events the user unticked, events behind changes they rejected, and
// every event when they rejected all changes or the model proposed none —
// stays pending, so it is sent again next time and can accumulate into a
// pattern instead of being marked "already incorporated" without ever
// having been used.
//
// Attribution uses the rationales. prompts/suggest-profile.md requires each
// change's rationale to cite the feedback that motivated it ("Based on stars
// on 2504.01234 and 2504.03456, ..."):
//   - a paper event (star, dismiss, paper comment, filter override) counts
//     when an accepted rationale cites its arXiv ID (any version suffix) or
//     its full title;
//   - a note or general comment has no ID; it counts when an accepted
//     rationale quotes it. An unquoted note still counts when at least one
//     change was accepted, unless a rejected rationale quotes it: notes
//     shape the whole revision rather than one edit.

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[“”‘’"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rationaleCitesPaper(rationale, event) {
  const text = String(rationale ?? '');
  if (!text) return false;
  const base = String(event?.arxivId ?? '').replace(/v\d+$/i, '');
  if (base) {
    // Not preceded by a digit or '.', not followed by a digit: 2504.0123
    // must not match inside 2504.01234.
    const re = new RegExp(`(?<![\\d.])${escapeRegExp(base)}(?:v\\d+)?(?!\\d)`, 'i');
    if (re.test(text)) return true;
  }
  // Titles only when distinctive: a two-word title ("Head pruning") could
  // appear in any rationale.
  const title = normalize(event?.paperTitle);
  return title.split(' ').length >= 4 && normalize(text).includes(title);
}

const QUOTE_WINDOW = 5; // words

export function rationaleQuotesText(rationale, quoted) {
  const words = normalize(quoted).split(' ').filter(Boolean);
  if (words.length === 0) return false;
  const haystack = normalize(rationale);
  if (words.length <= QUOTE_WINDOW) return haystack.includes(words.join(' '));
  for (let i = 0; i + QUOTE_WINDOW <= words.length; i += 1) {
    if (haystack.includes(words.slice(i, i + QUOTE_WINDOW).join(' '))) return true;
  }
  return false;
}

function changeCites(change, event) {
  return event.arxivId
    ? rationaleCitesPaper(change.rationale, event)
    : rationaleQuotesText(change.rationale, event.text);
}

/**
 * @param {{
 *   sentEvents: Array<object>,   // the feedback events actually POSTed
 *   changes: Array<{id: string, rationale: string, edit: object}>,
 *   acceptedIds: Array<string> | Set<string>,
 * }} input
 * @returns {{accepted: Array<object>, rejected: Array<object>, incorporatedEventIds: string[]}}
 */
export function resolveSuggestionOutcome({ sentEvents = [], changes = [], acceptedIds = [] }) {
  const acceptedSet = new Set(acceptedIds);
  const accepted = changes.filter((c) => acceptedSet.has(c.id));
  const rejected = changes.filter((c) => !acceptedSet.has(c.id));
  if (accepted.length === 0) return { accepted, rejected, incorporatedEventIds: [] };

  const incorporatedEventIds = [];
  for (const event of sentEvents) {
    if (!event?.id) continue;
    if (accepted.some((c) => changeCites(c, event))) {
      incorporatedEventIds.push(event.id);
      continue;
    }
    // A paper event needs an accepted citation; uncited or rejected-only
    // ones stay pending.
    if (event.arxivId) continue;
    if (!rejected.some((c) => changeCites(c, event))) incorporatedEventIds.push(event.id);
  }
  return { accepted, rejected, incorporatedEventIds };
}
