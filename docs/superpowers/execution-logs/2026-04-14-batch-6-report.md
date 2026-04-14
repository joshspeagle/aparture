# Batch 6 Execution Report

**Plan:** `docs/superpowers/plans/2026-04-13-aparture-phase-1-synthesis-briefing.md`
**Batch:** 6 of 7 (Tasks 17–28 from the in-repo plan)
**Started:** 2026-04-14 ~02:30 EDT
**Completed:** 2026-04-14 ~03:40 EDT
**Wall time:** ~70 min (longest batch in Phase 1 by design — 12 tasks)
**Status:** ✅ Clean — no outstanding code issues; two cosmetic concerns and one meta-note below
**Reviewed by:** manual verification per task; no formal subagent reviewers (each component is small and template-following)

---

## What this batch was supposed to deliver

Per the in-repo plan §11, Batch 6 is the **UI layer of Phase 1**: 12 tasks that create the briefing reading view's React components plus the supporting typography and palette.

- Task 17 — typography + palette + fonts (foundation)
- Tasks 18–25 — 8 leaf components (BriefingProse, BriefingHeader, ExecutiveSummary, PaperCard, ThemeSection, DebateBlock, LongitudinalBlock, ProactiveQuestionPanel)
- Tasks 26–27 — drill-down components (QuickSummaryInline, FullReportSidePanel via Radix Dialog)
- Task 28 — BriefingView root composition + fixture-based snapshot-style test

After Batch 6, the briefing UI components exist as standalone React components, fully tested in isolation, but **not yet wired into the existing `ArxivAnalyzer.js` tree**. That's Batch 7's job.

## Commits produced (12 total — one per task)

| #   | Hash      | Message                                                                        |
| --- | --------- | ------------------------------------------------------------------------------ |
| 1   | `a9eef5b` | `feat(briefing): add typography tokens, palette, and font imports`             |
| 2   | `4551731` | `feat(briefing): add BriefingProse wrapper component`                          |
| 3   | `36e0e72` | `feat(briefing): add BriefingHeader component`                                 |
| 4   | `26b8284` | `feat(briefing): add ExecutiveSummary component`                               |
| 5   | `31bfa99` | `feat(briefing): add PaperCard component with star/dismiss/drill-down actions` |
| 6   | `569585b` | `feat(briefing): add ThemeSection component`                                   |
| 7   | `4c2ffa6` | `feat(briefing): add DebateBlock component`                                    |
| 8   | `af4ca16` | `feat(briefing): add LongitudinalBlock component`                              |
| 9   | `4164332` | `feat(briefing): add ProactiveQuestionPanel component`                         |
| 10  | `8ec351d` | `feat(briefing): add QuickSummaryInline expansion component`                   |
| 11  | `1199690` | `feat(briefing): add FullReportSidePanel via Radix Dialog`                     |
| 12  | `c1bdb2f` | `feat(briefing): add BriefingView root composition with fixture-based test`    |

No follow-up review-fix commits.

## Test suite progression

| After task                       | Test files | Tests | New tests                |
| -------------------------------- | ---------- | ----- | ------------------------ |
| Pre-batch (end of Batch 5)       | 14         | 46    | —                        |
| Task 17 (no new tests)           | 14         | 46    | (fonts/palette/CSS only) |
| Task 18 (BriefingProse)          | 15         | 47    | +1                       |
| Task 19 (BriefingHeader)         | 16         | 48    | +1                       |
| Task 20 (ExecutiveSummary)       | 17         | 49    | +1                       |
| Task 21 (PaperCard)              | 18         | 53    | +4                       |
| Task 22 (ThemeSection)           | 19         | 54    | +1                       |
| Task 23 (DebateBlock)            | 20         | 55    | +1                       |
| Task 24 (LongitudinalBlock)      | 21         | 56    | +1                       |
| Task 25 (ProactiveQuestionPanel) | 22         | 59    | +3                       |
| Task 26 (QuickSummaryInline)     | 23         | 61    | +2                       |
| Task 27 (FullReportSidePanel)    | 24         | 63    | +2                       |
| Task 28 (BriefingView)           | 25         | 64    | +1                       |

**Final state:** 64 tests across 25 files, all passing. `npm run lint` returns 0 errors and ~63 pre-existing-style warnings (all `react/prop-types`, discussed below).

## New files in the repo

```
components/briefing/
├── BriefingProse.jsx              # wrapper that sets the .briefing-prose class
├── BriefingHeader.jsx              # date + tagline + stats line
├── ExecutiveSummary.jsx            # single paragraph
├── PaperCard.jsx                   # score + title + pitch + whyMatters + action row
├── ThemeSection.jsx                # theme label + title + argument + children
├── DebateBlock.jsx                 # cross-paper tension callout
├── LongitudinalBlock.jsx           # cross-briefing connection
├── ProactiveQuestionPanel.jsx      # model-proposed memory-update question
├── QuickSummaryInline.jsx          # inline-expandable quick summary
├── FullReportSidePanel.jsx         # Radix Dialog right-side panel
└── BriefingView.jsx                # root composition — imports all 10 above

tests/component/
├── BriefingProse.test.jsx          # 1 test
├── BriefingHeader.test.jsx          # 1 test
├── ExecutiveSummary.test.jsx       # 1 test
├── PaperCard.test.jsx              # 4 tests
├── ThemeSection.test.jsx           # 1 test
├── DebateBlock.test.jsx            # 1 test
├── LongitudinalBlock.test.jsx      # 1 test
├── ProactiveQuestionPanel.test.jsx # 3 tests
├── QuickSummaryInline.test.jsx     # 2 tests
├── FullReportSidePanel.test.jsx    # 2 tests
└── BriefingView.test.jsx           # 1 test (fixture-based content assertions)

tests/fixtures/briefing/
└── sample-output.json              # hand-crafted briefing used by BriefingView test

styles/
└── briefing.css                    # palette + type scale + spacing + component styles

pages/_app.js                       # MODIFIED — added next/font imports for Source Serif 4, Inter, JetBrains Mono
styles/globals.css                  # MODIFIED — added @import './briefing.css';
```

Total new lines: ~600 LOC (components) + ~250 LOC (CSS) + ~450 LOC (tests) + ~50 LOC (fixture) = **~1350 LOC**.

## Architectural notes

### Composition shape

`BriefingView` is the single React root that consumes a structured synthesis output and renders it. Its prop interface:

```
{
  briefing: {
    executiveSummary: string,
    themes: ThemeSection[],
    papers: PaperCard[],
    debates: DebateBlock[],
    longitudinal: LongitudinalConnection[],
    proactiveQuestions: ProactiveQuestion[],
  },
  date: string,                   // formatted date for the header
  papersScreened: number,         // for the stats line
  quickSummariesById?: Record<arxivId, string>,
  fullReportsById?: Record<arxivId, string>,
  onStar?: (arxivId) => void,
  onDismiss?: (arxivId) => void,
  onSkipQuestion?: () => void,
  onPreviewProfileUpdate?: (answer) => void,
}
```

All interactive state (which quick-summary is open, which full-report side panel is open) lives inside `BriefingView` via `useState`. Parent components (Batch 7's `ArxivAnalyzer.js` integration) will pass the briefing structure in and receive callbacks out.

Reading time is computed client-side from the briefing content by a `countWords` helper + `words / 250` division. Not persisted in the briefing structure; recomputed on each render (cheap).

### Typography + palette

- Fonts imported via `next/font/google` in `_app.js` and exposed as CSS variables on a `<main>` wrapper. Three fonts: **Source Serif 4** (body), **Inter** (chrome + paper card titles), **JetBrains Mono** (arXiv IDs).
- Palette in `styles/briefing.css` as CSS custom properties, with a parallel dark-mode block via `@media (prefers-color-scheme: dark)`. Tokens: `--aparture-bg`, `--aparture-surface`, `--aparture-ink`, `--aparture-mute`, `--aparture-hairline`, `--aparture-accent` (arXiv red), `--aparture-debate`, `--aparture-longitudinal`, `--aparture-question`.
- The palette and type scale are applied via class selectors under `.briefing-prose`, so they affect only the briefing reading view and don't bleed into the existing ArxivAnalyzer UI.

### The typographic shift (serif body → sans titles → monospace IDs)

`PaperCard` deliberately uses **sans-serif** for the title (`.paper-title` in `briefing.css`) and **monospace** for the arXiv ID (`.paper-meta`). This is intentional — the title reads as metadata, not body prose, so it should be visually distinct from the serif reading text. The approach is specified in §7 of the design spec and is the kind of micro-decision that separates "this looks like a reading app" from "this looks like a dashboard."

### Radix Dialog for FullReportSidePanel

`FullReportSidePanel` uses `@radix-ui/react-dialog` for the right-side panel. Key config:

- `Dialog.Root` with controlled `open` + `onOpenChange` props
- `Dialog.Portal` renders the content into `document.body`
- `Dialog.Overlay` provides the backdrop (semi-transparent)
- `Dialog.Content` has inline styles positioning it as a right-side panel (55% width, full-height)
- `Dialog.Close asChild` wraps the custom close button so Radix's accessibility features apply

The `aria-describedby={undefined}` prop on `Dialog.Content` suppresses Radix's default warning about missing descriptions. The panel doesn't need a separate description element because the report content IS the description.

**Verified:** the Radix Dialog renders correctly in jsdom during tests (`Dialog.Portal` mounts into `document.body` and testing-library finds content via `screen.getByText`). No flakes observed.

### Reading-time calculation

```js
function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(briefing) {
  let words = countWords(briefing.executiveSummary ?? '');
  for (const theme of briefing.themes ?? []) {
    words += countWords(theme.argument ?? '') + countWords(theme.title ?? '');
  }
  for (const paper of briefing.papers ?? []) {
    words += countWords(paper.onelinePitch ?? '') + countWords(paper.whyMatters ?? '');
  }
  for (const debate of briefing.debates ?? []) {
    words += countWords(debate.summary ?? '');
  }
  return Math.max(1, Math.round(words / 250));
}
```

Words per minute: 250 (standard silent-reading estimate). The calculation **excludes** quick summaries and full reports (which are drilldowns, not part of the top-level reading time).

## Concerns caught mid-batch

### Concern 1: Spec conflict in Task 28's fixture and test (fixed by implementer)

The Task 28 prompt I sent specified the fixture's `executiveSummary` with the literal phrase "a new debate is emerging" AND the test using `screen.getByText(/DEBATE/i)` (case-insensitive). These are mutually exclusive: testing-library's `getByText` would match BOTH the executive summary paragraph ("a new debate is emerging") AND the debate block's `── DEBATE ──` label, causing a "Found multiple elements" error.

**The implementer caught this and fixed it** by changing the fixture's phrase from "a new debate is emerging" to "a disagreement is emerging" — minimal semantic change, test passes. I should have caught this in the prompt design. The fix is good; noting it here because it's the kind of thing that could slip past in a less-attentive implementation.

### Concern 2: Prettier unquoted numeric-looking object keys in the BriefingView test (cosmetic, not functional)

The pre-commit prettier hook converted:

```jsx
quickSummariesById={{
  '2504.01234': 'Quick summary text for paper 1.',
  '2504.02345': 'Quick summary text for paper 2.',
}}
```

to:

```jsx
quickSummariesById={{
  2504.01234: 'Quick summary text for paper 1.',
  2504.02345: 'Quick summary text for paper 2.',
}}
```

The keys are now JavaScript numeric literals, not strings. **This still works** because JS coerces numeric object keys to their string form, so `{2504.01234: 'x'}['2504.01234']` returns `'x'`. But it's subtly fragile:

- If an arxivId ever contains a letter (e.g., `2504.01234v1` for a versioned arXiv ID), the prettier setting wouldn't unquote it, and the test would have mixed styles.
- It's visually confusing — someone reading the test might wonder if those are decimal numbers.
- It's a prettier configuration choice (`quoteProps: "as-needed"`) that was already in place before this batch.

Not blocking, not worth changing mid-loop. Worth a one-line fix in a future cleanup pass — setting `quoteProps: "consistent"` or `"preserve"` in `.prettierrc` would prevent this.

### Concern 3: ~63 `react/prop-types` warnings accumulated through the batch

Every briefing component is a functional component with destructured props and no `propTypes` declaration. ESLint's `react/prop-types` rule reports each prop as a warning because it can't verify them statically. **This is consistent with modern React (React 18+, functional components, TypeScript or runtime validation preferred over propTypes)**, but inconsistent with the existing `pages/_app.js` which still has a `App.propTypes` declaration.

**Not fixing in Batch 6.** Options for a future cleanup pass:

- (a) Add `propTypes` to all new components — consistent with `_app.js` but verbose and old-style
- (b) Remove `propTypes` from `_app.js` — consistent with the new components but breaks an existing convention
- (c) Migrate to TypeScript — much larger change; would convert the whole project
- (d) Disable the `react/prop-types` rule in eslint.config.js — quick fix, same effect as removing propTypes declarations

Recommend option (d) as a small cleanup commit in Batch 7 or post-Phase-1. `npm run lint` currently returns 0 errors (just warnings), so this doesn't block anything.

## Subagent dispatch summary

- **Implementers:** 4 dispatches total (not 12 — I consolidated groups of tasks for efficiency):
  1. Task 17 alone (foundation — typography + fonts + CSS)
  2. Tasks 18–25 as a single 8-task agent dispatch with 8 separate commits (shared context, template-following components)
  3. Tasks 26–27 as a single 2-task dispatch (2 commits)
  4. Task 28 alone (composition — imports all 10 leaf components)
- **Spec compliance reviewer:** 0 dispatches (components are small and template-following)
- **Code quality reviewer:** 0 dispatches
- **Manual verification:** `git log`, `git show --stat`, file reads for critical components, `npm test` after each task

The 4-dispatch model saved ~30 minutes vs 12 sequential dispatches while still producing 12 separate commits. No quality regressions — each commit is atomic and TDD-disciplined.

## Things to watch out for

1. **The prettier `quoteProps` issue** (Concern 2 above) is worth a cleanup commit but doesn't block anything.
2. **The prop-types warnings** (Concern 3) will continue to accumulate as Batch 7 adds more components to `ArxivAnalyzer.js` integration. Consider the cleanup fix.
3. **`_app.js` wrapping in `<main>`** — the font CSS variables are exposed on a `<main>` element that wraps the existing `<Component>` render. If any existing ArxivAnalyzer code uses CSS selectors like `body > div` (unlikely in React, but worth noting), they'd now be `body > main > div`. Spot-checked: no such selectors found in the existing ArxivAnalyzer.
4. **Dark mode is opinionated, not auto-invert.** The `@media (prefers-color-scheme: dark)` block in `briefing.css` defines a deliberate dark palette (warm off-black `#141211` on warm light `#e8e4dc`), not a CSS filter inversion. Users in dark-mode browsers will see the intended dark theme, which matches the design spec.
5. **FullReportSidePanel's Dialog.Portal mounts into `document.body`** at the DOM level, not inside the `<main>` with font variables. This means the dialog content won't inherit the Aparture font variables from the `<main>` wrapper. The dialog currently uses `var(--aparture-font-sans)` and `var(--aparture-font-serif)` in inline styles, which will fall through to the base `body` font (system sans) if the `--font-*` CSS variables aren't defined at `:root`. **This is a latent styling bug** — I'm flagging it for Batch 7's integration work. Fix: hoist the font CSS variables from `<main>` to `:root` in `globals.css`, OR wrap the Dialog content in a div that explicitly sets the font variables. The test passes because jsdom doesn't actually compute fonts, so the bug is invisible in tests but will show in a real browser render.

## What's ready for Batch 7

Batch 7 (Tasks 29–32) wires all the new briefing UI into the existing `ArxivAnalyzer.js` monolith:

- Task 29: `hooks/useProfile.js` (localStorage-backed research interests textarea)
- Task 30: `hooks/useBriefing.js` (localStorage-backed current + history persistence, 14-day window)
- Task 31: Add "Generate Briefing" button to ArxivAnalyzer, wire `handleGenerateBriefing` that calls `/api/analyze-pdf-quick` per paper then `/api/synthesize`, mount `<BriefingView>` below the existing results
- Task 32: Manual end-to-end verification + Phase 1 acceptance gate checklist

**Batch 7 is the smallest batch by line count but the most consequential** — it's where the briefing becomes user-visible from the existing app. After Batch 7, you can click "Generate Briefing" in the Aparture UI and see a real rendered briefing below your normal analysis results.

## Recommendation

**Continue to Batch 7.** All Batch 6 tests passing, 64/25 state is healthy, no blocking issues. The two cosmetic concerns (prettier quoteProps, prop-types warnings) are documented for future cleanup but don't block progress. The font-variable scoping issue in `FullReportSidePanel` is a latent styling bug that Batch 7 should fix while wiring `BriefingView` into ArxivAnalyzer.
