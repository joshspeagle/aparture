// Builds the per-run focus prompt the user pastes into NotebookLM's
// audio-customization textarea. Pure text transform, no LLM call — the
// briefing IS the content plan, this prompt just instructs NotebookLM
// how to voice it.

export function buildFocusPrompt(briefing, duration) {
  const themes = briefing.themes ?? [];
  const papers = briefing.papers ?? [];

  const themeLines =
    themes.length > 0
      ? themes.map((t, i) => `${i + 1}. ${t.title} — ${t.argument}`).join('\n')
      : '(No themes — cover the papers individually.)';

  const paperLines =
    papers.length > 0
      ? papers.map((p, i) => `- [P${i + 1}] "${p.title}" (${p.arxivId}) — ${p.score}/10`).join('\n')
      : '(No papers — acknowledge the quiet day.)';

  return `This podcast is an audio substitute for a daily research briefing. The listener is a researcher who will flag papers to read later during a commute — every paper mention must include the title and arXiv ID clearly enough to write down.

Today's themes:
${themeLines}

Papers to make sure you cover:
${paperLines}

Expert-to-expert tone. Skip basic exposition. Focus on methodology, cross-paper tensions, and implications. Target length: ${duration} minutes.

Citation rules:
- Always say paper titles and arXiv IDs explicitly — "The paper 'X' from Smith et al., arXiv 2504.01234…"
- Use [P#] notation only when referring to sections of the discussion-guide source
- If you can't verify a claim against the sources, flag it rather than fabricating
`;
}
