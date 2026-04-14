# Aparture Phase 1 — Acceptance Gate Checklist

**Purpose:** This document captures the acceptance criteria for moving from Phase 1 to Phase 2 of the Aparture refactor, as specified in `2026-04-13-aparture-refactor-design.md` §11.

**Gate condition:** Before starting Phase 2, the builder runs Aparture daily for **2 weeks** and honestly answers the question: **"Is the Phase 1 briefing better than the current tool's `arxiv_analysis` markdown output for my morning triage?"**

If yes, Phase 2 begins. If no, synthesis prompt iteration continues before any platform work.

## What "better" means, operationally

At least **3 of the following 5** must be true after 2 weeks of daily use:

- [ ] **The executive summary is consistently useful.** It gives me a headline I couldn't have gotten from the paper titles alone. It does not read like a generic "Today in X field..." boilerplate.
- [ ] **Theme sections actually group related papers meaningfully.** Themes reflect real editorial connections, not just "papers that happened on the same day." I can trust the theme headline to tell me what the grouping is about.
- [ ] **The "why this matters to you" paragraph is grounded in my profile.** It references specific things I wrote in `profile.md`, not generic academic commentary. When it's wrong, it's wrong in a way I can correct by editing the profile.
- [ ] **Debate blocks and longitudinal connections appear when they should, and don't appear when they shouldn't.** The model does not invent tensions between unrelated papers. When two papers actually disagree, the debate block names the disagreement correctly.
- [ ] **The faithful technical depth of the per-paper full report is preserved.** The briefing references papers with ~800–1500 word reports that are faithful compressed re-derivations (this is the current tool's moat and must not regress).

## Regressions that block Phase 2 regardless of "better"

- [ ] **The current tool's `arxiv_analysis_XXmin.md` output is still generated** and still has the same quality as before Phase 1 started. Phase 1 must not degrade the existing tool.
- [ ] **Structured output repair does not fall over** more than once or twice per 14-day period (occasional failures are fine; consistent failures mean the schema or prompt needs revision).
- [ ] **Token budget pre-flight fires** when it should — at least one notice or block event during the 2-week window, to verify the mechanism works.
- [ ] **The test suite remains green.** Any added test fixtures are kept up-to-date.

## If the gate fails

If fewer than 3 of the 5 "better" criteria hold or any regression is present, **do not start Phase 2**. Instead:

1. Identify which criterion failed and why
2. Iterate on `prompts/synthesis.md` (most likely cause)
3. Add any new failing scenarios as cached fixtures in `tests/fixtures/llm/`
4. Re-run the 2-week test

## If the gate passes

1. Write a short note in `docs/superpowers/plans/` summarizing: which criteria passed cleanly, which were marginal, what prompt changes happened during the 2 weeks, and any issues to address in Phase 2
2. Begin writing the Phase 2 implementation plan
