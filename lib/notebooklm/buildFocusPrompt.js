// Builds the per-run focus prompt the user pastes into NotebookLM's
// audio-customization textarea. Strategy-only — briefing.md,
// discussion-guide.md, and the per-paper reports are all uploaded as
// NotebookLM sources, so we don't re-enumerate their content here. This
// file tells NotebookLM HOW to use those sources: depth, tone, pacing,
// citation rules, and the duration-scaled pruning budget.

function depthStrategyFor(duration) {
  // How many papers to deep-dive vs. briefly mention vs. drop, scaled to
  // the podcast length. A 20-minute episode cannot give 20 papers any real
  // attention — prune hard and prioritize by score.
  if (duration <= 5) {
    return {
      themes: '1 theme',
      deep: '2-3 top-scored papers (~90 seconds each)',
      brief: 'none — stay focused',
      drop: 'everything else, including sub-8/10 scores',
    };
  }
  if (duration <= 10) {
    return {
      themes: '2 themes',
      deep: '3-5 top-scored papers (~90 seconds each)',
      brief: '1-2 notable mentions at ~20 seconds',
      drop: 'anything scored below 7/10',
    };
  }
  if (duration <= 15) {
    return {
      themes: '2-3 themes',
      deep: '4-6 top-scored papers (~2 minutes each)',
      brief: '2-3 notable mentions at ~30 seconds',
      drop: 'anything scored below 7/10',
    };
  }
  if (duration <= 20) {
    return {
      themes: '3 themes',
      deep: '5-7 top-scored papers (~2 minutes each)',
      brief: '3 notable mentions at ~30 seconds',
      drop: 'anything scored below 7/10',
    };
  }
  return {
    themes: '3-4 themes',
    deep: '6-9 top-scored papers (~2-3 minutes each)',
    brief: '3-4 notable mentions at ~30 seconds',
    drop: 'anything scored below 5/10',
  };
}

export function buildFocusPrompt(_briefing, duration) {
  const s = depthStrategyFor(duration);
  return `This podcast is an audio substitute for today's research briefing. The listener is a researcher who will flag papers to read later during a commute — every paper mention must include the title and arXiv ID clearly enough to write down.

Follow the structure in the discussion-guide.md source — it contains the act breakdown, must-cite papers per theme, and conversation prompts the outline has already selected. briefing.md gives you the narrative frame; the papers/ folder has per-paper depth to draw on.

Target length: ${duration} minutes.

Depth strategy (budget the time accordingly):
- Cover ${s.themes} drawn from the discussion guide
- Deep-dive on ${s.deep}
- Add ${s.brief}
- DO NOT try to cover every paper — drop ${s.drop}

Tone: expert-to-expert. Skip basic exposition. Lean into methodology, cross-paper tensions, and implications.

Citation rules:
- Always say paper titles AND arXiv IDs explicitly — e.g. "the authors of arXiv 24NN.NNNNN, titled '<exact title>', argue that..."
- Repeat the arXiv ID the first time you cite each paper so the listener can write it down
- Use [P#] notation only when quoting the discussion-guide source
- If a claim can't be verified against the sources, flag it rather than fabricating
`;
}
