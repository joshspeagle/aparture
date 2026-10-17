// Builds the per-run focus prompt the user pastes into Gemini Notebook's
// audio-customization textarea. Strategy-only — briefing.md,
// discussion-guide.md, and the per-paper reports are all uploaded as
// notebook sources, so we don't re-enumerate their content here. This
// file tells the notebook HOW to use those sources: depth, tone, pacing,
// citation rules, and the pruning budget for the chosen length preset
// (podcastLength.js).

import { podcastLengthInfo, WORDS_PER_MINUTE } from './podcastLength.js';

// The listener's podcast-scoped editorial notes, as they wrote or accepted
// them; empty adds nothing.
function notesSection(notes) {
  const lines = (notes ?? []).filter((n) => typeof n === 'string' && n.trim());
  if (lines.length === 0) return '';
  return `\n## The listener's notes\n\nThe listener asked for these in earlier episodes; follow them unless they conflict with the rules above.\n\n${lines.map((n) => `- ${n.trim()}`).join('\n')}\n`;
}

export function buildFocusPrompt(_briefing, length, { notes = [] } = {}) {
  const s = podcastLengthInfo(length);
  // A concrete spoken-word budget, even though the notebook's own length
  // option stretches or compresses the final audio.
  const words = (m) => (m * WORDS_PER_MINUTE).toLocaleString('en-US');
  return `This podcast is an audio substitute for today's research briefing. The listener is a researcher who will flag papers to read later during a commute — every paper mention must include the title and arXiv ID clearly enough to write down.

Follow the structure in the discussion-guide.md source — it contains the act breakdown, must-cite papers per theme, and conversation prompts the outline has already selected. briefing.md gives you the narrative frame; the papers/ folder has per-paper depth to draw on.

## Length target

Target length: ${s.label}, about ${s.range}. At conversational pace (~${WORDS_PER_MINUTE} words/minute), that is roughly ${words(s.minMinutes)}–${words(s.maxMinutes)} words of spoken content total. Budget your word count accordingly. If the audio length setting stretches or compresses the final length, prioritize keeping the number of papers and depth intact — compress commentary, don't drop papers.

## What to skip (this is critical — it wastes minutes on short episodes)

- **No preamble.** Open on the substantive hook in the first sentence. Do NOT introduce yourselves, do NOT say "welcome back" or "today we're going to", do NOT preview the agenda. The listener subscribes and already knows what this is. The first words out of your mouths should be about the first paper or the first theme, not about the show.
- **No meta-narration.** Do not mention the outline, the discussion guide, the focus prompt, the briefing, or the sources you're drawing on. Do not announce what you will do — just do it. Do not reassure the listener that you will cite arXiv IDs or follow any format; just cite them.
- **No filler or stalling.** No "that's a great question", no "let me think about that", no repeating what the other host just said before responding. Keep the turns tight.

## Depth strategy

- Cover ${s.themes} drawn from the discussion guide
- Deep-dive on ${s.deep}
- Add ${s.brief}
- DO NOT try to cover every paper — drop ${s.drop}

## Tone

Expert-to-expert. Skip basic exposition. Lean into methodology, cross-paper tensions, and implications.

## Citation rules

- Always say paper titles AND arXiv IDs explicitly — e.g. "the authors of arXiv 24NN.NNNNN, titled '<exact title>', argue that..."
- Repeat the arXiv ID the first time you cite each paper so the listener can write it down
- Use [P#] notation only when quoting the discussion-guide source
- If a claim can't be verified against the sources, flag it rather than fabricating
${notesSection(notes)}`;
}
