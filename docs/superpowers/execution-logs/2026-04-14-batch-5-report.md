# Batch 5 Execution Report

**Plan:** `docs/superpowers/plans/2026-04-13-aparture-phase-1-synthesis-briefing.md`
**Batch:** 5 of 7 (Tasks 13–16 from the in-repo plan)
**Started:** 2026-04-14 ~02:00 EDT
**Completed:** 2026-04-14 ~02:27 EDT
**Wall time:** ~27 min
**Status:** ✅ Clean, no outstanding issues — but **synthesis prompt quality is genuinely unknown** until tested against real arXiv data (see "Risk callout" below)
**Reviewed by:** manual verification per task; no formal subagent reviewers (each task is small + literal code from plan)

---

## What this batch was supposed to deliver

Per the in-repo plan §11, Batch 5 corresponds to Tasks 13–16 — the **first user-callable end-to-end synthesis pipeline** in Phase 1:

- The synthesis prompt template at `prompts/synthesis.md` (Task 13) — ~150 lines of editorial-register instructions for the structured output
- The `pages/api/synthesize.js` API route (Task 14) that loads the prompt, renders it with profile/papers/history, calls the LLM with structured output, validates the response, and runs repair if validation fails
- A fixture-based integration test (Task 15) that exercises the synthesize route end-to-end without making real LLM calls
- The `pages/api/analyze-pdf-quick.js` API route (Task 16) for compressing per-paper full reports into ~300-word quick summaries

After Batch 5, the synthesis pipeline is **wired end-to-end at the API layer**. The UI rendering is still ahead in Batch 6.

## Commits produced (4 total)

| #   | Hash      | Message                                                                          | Source              |
| --- | --------- | -------------------------------------------------------------------------------- | ------------------- |
| 1   | `780fba3` | `feat(synthesis): add synthesis prompt template`                                 | Task 13 implementer |
| 2   | `af5094d` | `feat(api): add synthesize route with repair + token budget preflight`           | Task 14 implementer |
| 3   | `0f786f4` | `test(synthesize): add fixture-based integration test`                           | Task 15 implementer |
| 4   | `ad1d194` | `feat(api): add analyze-pdf-quick for quick summary generation from full report` | Task 16 implementer |

No follow-up review-fix commits.

## Test suite progression

| After task                 | Test files | Tests | New tests                                      |
| -------------------------- | ---------- | ----- | ---------------------------------------------- |
| Pre-batch (end of Batch 4) | 11         | 42    | —                                              |
| Task 13                    | 11         | 42    | (prompt file only — no tests)                  |
| Task 14                    | 12         | 44    | + `renderPrompt.test.js` (2)                   |
| Task 15                    | 13         | 45    | + `synthesize.test.js` (1, integration)        |
| Task 16                    | 14         | 46    | + `analyze-pdf-quick.test.js` (1, integration) |

**Final state:** 46 tests across 14 files, all passing. `npm run lint` clean.

## New files in the repo

```
prompts/
├── synthesis.md           # 150-line synthesis prompt template (Task 13)
└── analyze-pdf-quick.md   # ~30-line quick summary prompt template (Task 16)

lib/synthesis/
└── renderPrompt.js        # Template slot substitution (Task 14)

pages/api/
├── synthesize.js          # First user-callable synthesis API route (Task 14)
└── analyze-pdf-quick.js   # Quick summary compression route (Task 16)

tests/unit/synthesis/
└── renderPrompt.test.js   # 2 tests (Task 14)

tests/integration/
├── synthesize.test.js              # 1 fixture-based integration test (Task 15)
└── analyze-pdf-quick.test.js       # 1 fixture-based integration test (Task 16)

tests/fixtures/synthesis/
└── generate-sample.mjs             # Helper to seed the synthesize fixture (Task 15)

tests/fixtures/llm/
└── cb5c35a993be5903d06baf2e65a99d92.json   # Cached synthesis response for the integration test
```

## Modified files

- `eslint.config.js` — Task 15 implementer added a small `**/*.mjs` override block exposing `console` and `process` globals, needed for the new `generate-sample.mjs` helper script to lint clean. Minor scope creep, but justified — without it, `npm run lint` would have failed on the helper.

## Architectural notes

### The synthesis API route's data flow (most important read)

`POST /api/synthesize` takes the following request body:

```
{
  profile: string,             // user's research interests prose
  papers: Array<PaperSummary>, // list of papers to synthesize over (each must have arxivId)
  history: Array<HistoryEntry>, // recent engagement history
  provider: 'anthropic' | 'google' | 'openai',
  model: string,
  apiKey: string,
  budgetThresholds?: { notice: number, block: number },
  allowOverBudget?: boolean,
  callModelMode?: { mode: 'live' } | { mode: 'fixture', fixturesDir: string }, // test hook
}
```

And returns:

```
{
  briefing: BriefingSchema,
  tokensIn: number,
  tokensOut: number,
  repaired: boolean,
  preflight: { action: 'proceed' | 'notice' | 'block', estimatedTokens: number },
  originalValidationErrors?: string[], // populated only when repair was needed
}
```

The flow:

1. **Validate request body** — return 400 if any required field is missing
2. **Load `prompts/synthesis.md`** from disk (cached by Node's filesystem layer on subsequent calls)
3. **Render the prompt** via `renderSynthesisPrompt(template, { profile, papers, history })`. The renderer throws if any required template slot is missing.
4. **Token budget pre-flight** via `estimateTokens` + `budgetPreflight`. If the action is `'block'` and `allowOverBudget` is false, return 400.
5. **First LLM call** via `callModel` with the structured output schema from `toJsonSchema()`. The call uses fixture mode if `callModelMode` is set in the request body (test path) or live mode otherwise.
6. **Validate the structured output** via `validateBriefing`. If valid, return 200 with `repaired: false`.
7. **Repair pass** via `repairBriefing` — makes a second LLM call with the original briefing + validation errors as context. If the repair also fails, the route propagates the error to a 500.
8. **Return 200** with `repaired: true` and the original validation errors in `originalValidationErrors` for debugging.

### Test hooks: `APARTURE_TEST_PROMPT_OVERRIDE` + `callModelMode`

Two test hooks were intentionally added to make the synthesis route testable without real LLM calls:

- `process.env.APARTURE_TEST_PROMPT_OVERRIDE` — when set, the synthesis route uses this string instead of the rendered prompt template. Tests use this to feed a known string (`'SYNTHESIS_PROMPT_FIXTURE'`) so the input hash is stable.
- `callModelMode` from the request body — when set to `{ mode: 'fixture', fixturesDir: ... }`, the route routes through the fixture loader instead of making a real network call.

Together these let the integration test exercise the entire synthesize → validate → respond flow without hitting Anthropic.

### The integration test pattern

Task 15's integration test follows a pattern that Task 16 also adopted:

1. Compute the input hash for a known synthesis call (the helper script in `tests/fixtures/synthesis/generate-sample.mjs` does this, OR Task 16's test does it inline in `beforeAll`)
2. Write a fixture file at `tests/fixtures/llm/<hash>.json` with a hand-crafted "good" response
3. The test fires `handler(req, res)` with `callModelMode: { mode: 'fixture', fixturesDir }` and `APARTURE_TEST_PROMPT_OVERRIDE` set to the known string
4. The fixture loader matches the hash and returns the canned response
5. The test asserts on the response body shape

This pattern is the foundation for the remaining batches' integration tests. It's cheap (no API calls, no money), deterministic, and exercises the full handler logic.

## Risk callout: synthesis prompt quality is unknown

**This is the one piece of the entire Phase 1 plan whose quality is genuinely untested.** Tasks 13 and 14 ship a prompt + a route that _handle the structure correctly_ (validated by the integration test in Task 15), but **the actual editorial quality of synthesis output on real arXiv papers has not been measured**. The integration test uses a hand-crafted "good" briefing as its fixture — it tests the routing, not the LLM's behavior.

What we don't know yet:

- **Will the model produce briefings whose `executiveSummary` actually reads as editorial prose, or will it default to "Today in X field..." despite the prompt's prohibition?**
- **Will the `whyMatters` paragraphs be grounded in the user's profile, or will they be generic academic commentary?**
- **Will the model invent paper IDs?** (The repair pass exists for this, but if the repair also invents IDs, the route returns a 500.)
- **Will it generate empty `themes` arrays?** (The schema technically allows this; the prompt forbids it.)
- **Will it generate bogus `debates` to fill space?** (The prompt says "Do not force debates" but this is a known model failure mode.)

The Phase 1 acceptance gate is specifically designed to surface these unknowns: the user runs Aparture daily for 2 weeks against real papers, reads the briefings, and answers "is this better than the current `arxiv_analysis` report?" If the answer is no, the synthesis prompt needs iteration before Phase 2 can begin.

**For the autonomous loop:** I am NOT pausing the loop here despite the unknown. The remaining batches (6 and 7) build the UI on top of this stage, which is necessary regardless of whether the prompt quality is acceptable. The user can iterate on the prompt after Phase 1 ships its UI; the prompt is a single editable file and changes take effect immediately. **If the user reads this report and decides the synthesis quality should be tested against real papers before Batch 6's UI work, they can pause the loop manually with `/cancel-ralph` and run a manual check.**

## Subagent dispatch summary

- **Implementers:** 4 dispatches (one per task), all `general-purpose` agents on `sonnet`, all returned DONE on first attempt
- **Spec compliance reviewer:** 0 dispatches
- **Code quality reviewer:** 0 dispatches
- **Manual verification:** read each new file before marking the task complete, ran `npm test` after each task

## Things to watch out for

1. **The Task 15 fixture is checked into git** at `tests/fixtures/llm/cb5c35a993be5903d06baf2e65a99d92.json`. The Task 16 fixture is **not** checked in — it's regenerated from `beforeAll` each test run. This asymmetry is intentional but could be confusing. Both approaches work for fixture-based testing; the Task 16 pattern is slightly cleaner because the fixture is always in sync with the prompt template (no risk of stale fixtures if someone edits `prompts/analyze-pdf-quick.md`).
2. **The Task 15 fixture WILL go stale** if anyone edits `prompts/synthesis.md` or `lib/synthesis/schema.js` (because both affect the input hash). When that happens, re-run `node tests/fixtures/synthesis/generate-sample.mjs` to regenerate. The helper script is committed.
3. **The eslint `.mjs` override block** added by Task 15 also exposes `process` as a global — currently only used by the helper script. If any future `.mjs` file in the repo uses `process` as a variable name (not the Node global), it would shadow this. Unlikely but worth noting.
4. **`pages/api/synthesize.js` reads `prompts/synthesis.md` from `process.cwd()/prompts/synthesis.md`** on every call. This works because Next.js API routes run with cwd set to the project root. If the route is later deployed to a different runtime (Vercel serverless, Electron, etc.), the prompt path resolution will need to change.
5. **The token budget pre-flight in `synthesize.js` uses the `estimateTokens` from `lib/llm/tokenBudget.js`** — for OpenAI this calls tiktoken (slow first import), for Anthropic and Google it uses the char heuristic. The pre-flight runs on every synthesize call, so the first call has a ~100-200ms tiktoken WASM warmup cost. Subsequent calls within the same Node process are cached.

## What's ready for Batch 6

Batch 6 is the **largest batch in Phase 1** by file count (Tasks 17–28, ~12 React components + typography + palette + the briefing reading view composition + a snapshot test). It builds the UI that renders the structured briefings the synthesize route now produces.

After Batch 6, the briefing UI components exist as standalone React components testable in isolation, but they're **not yet mounted into the existing `ArxivAnalyzer.js` tree**. That's Batch 7's job.

## Recommendation

**Continue to Batch 6.** All Batch 5 tests passing. Synthesis quality is unknown but that risk is acknowledged and mitigated by the user's planned 2-week acceptance gate at the end of Phase 1. Batch 6's UI work is necessary regardless of synthesis quality — if the prompt needs iteration, the UI gives the user a way to see what's going wrong.

**One caveat:** Batch 6 is the largest single batch in Phase 1. Wall-time estimate: ~30–60 minutes of subagent work for the 12 components + integration. This is the longest stretch of the autonomous loop. If anything is going to break, it's likely to break here.
