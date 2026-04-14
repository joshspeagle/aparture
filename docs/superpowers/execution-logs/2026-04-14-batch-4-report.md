# Batch 4 Execution Report

**Plan:** `docs/superpowers/plans/2026-04-13-aparture-phase-1-synthesis-briefing.md`
**Batch:** 4 of 7 (Tasks 10–12 from the in-repo plan)
**Started:** 2026-04-14 ~01:43 EDT
**Completed:** 2026-04-14 ~02:00 EDT
**Wall time:** ~17 min
**Status:** ✅ Clean — no outstanding issues
**Reviewed by:** manual verification (each task is a small focused TDD module with literal code from the plan)

---

## What this batch was supposed to deliver

Per the in-repo plan §11, Batch 4 corresponds to Tasks 10–12 (Phase B of the plan):

- The zod `BriefingSchema` and JSON-schema emitter (`toJsonSchema()`) used by the synthesis stage's structured-output call (Task 10)
- The citation validator (`validateBriefing` + `validateCitations`) that ensures every paper reference in a briefing is from the input list (Task 11)
- The two-pass repair prompting logic (`repairBriefing`) that asks the model to fix a malformed briefing when validation fails (Task 12)

Together these make up the synthesis stage's input/output contract: a typed schema, a runtime validator, and a recovery mechanism. Batch 5 (the actual synthesis API route) uses all three.

## Commits produced (3 total)

| #   | Hash      | Message                                                                  | Source              |
| --- | --------- | ------------------------------------------------------------------------ | ------------------- |
| 1   | `b0ab157` | `feat(synthesis): add zod + JSON schema for briefing output`             | Task 10 implementer |
| 2   | `c41a0ad` | `feat(synthesis): add citation validator for briefing output`            | Task 11 implementer |
| 3   | `cdc7442` | `feat(synthesis): add two-pass repair prompting for validation failures` | Task 12 implementer |

No follow-up review-fix commits.

## Test suite progression

| After task                 | Test files | Tests | New tests                 |
| -------------------------- | ---------- | ----- | ------------------------- |
| Pre-batch (end of Batch 3) | 8          | 32    | —                         |
| Task 10                    | 9          | 35    | + `schema.test.js` (3)    |
| Task 11                    | 10         | 39    | + `validator.test.js` (4) |
| Task 12                    | 11         | 42    | + `repair.test.js` (3)    |

**Final state:** 42 tests across 11 files, all passing. `npm run lint` clean.

## New files in the repo

```
lib/synthesis/
├── schema.js           # zod BriefingSchema + toJsonSchema (141 lines)
├── validator.js        # validateBriefing + validateCitations
└── repair.js           # repairBriefing (async, two-pass)

tests/unit/synthesis/
├── schema.test.js      # 3 tests
├── validator.test.js   # 4 tests
└── repair.test.js      # 3 tests
```

## Architectural notes

### The schema is hand-written for both zod and JSON-schema

The plan deliberately writes both representations by hand rather than auto-generating one from the other:

- `BriefingSchema` is a zod schema used at runtime to validate parsed model output. It enforces field presence, types, value ranges (score 0–10), enum constraints (`stance: tension | builds-on | compromise`), and minimum-length strings.
- `toJsonSchema()` returns a plain JSON Schema object passed to provider-native structured-output APIs (Anthropic `tool_use.input_schema`, Google `responseSchema`, OpenAI `response_format.json_schema.schema`).

The two are kept in sync by hand because (a) provider schemas have stricter constraints than zod (no defaults at the schema level, no transforms), (b) auto-generating from zod produces verbose output that includes refinements the providers reject, and (c) the schemas are small enough that drift is easy to spot.

### The validator separates schema from citation checks

`validateBriefing(briefing, inputPaperIds)` runs zod schema validation first, then citation validation. `validateCitations(briefing, inputPaperIds)` is exported separately so callers can run citation checks on already-schema-validated briefings without re-running zod.

The citation validator checks four reference sites:

- `papers[].arxivId` — every paper card must reference an ID in the input list
- `themes[].paperIds` — every theme's referenced papers must exist
- `debates[].paperIds` — every debate's referenced papers must exist
- `longitudinal[].todayPaperId` — the "today" side of a longitudinal connection must be in the input list (the `pastPaperId` is allowed to be anything since past papers may not be in today's input)

The four error messages each include the file/path/role and the offending arxivId for fast debugging.

### The repair function is testable in isolation via `vi.fn()`

`repairBriefing` accepts an injected `callModel` function rather than importing one. This makes it trivially testable — the tests pass `vi.fn().mockResolvedValue({...})` and verify (a) the function is not called when validation passes, (b) it is called once when validation fails and the model returns a valid fixed briefing, (c) it throws when the repair attempt also fails validation.

The injected `callModel` will be wired to `lib/llm/callModel.js` in Batch 5's synthesis API route.

### Known minor: `validateBriefing` doesn't return `data` on success

The current `validateBriefing` returns `{ ok: true, errors: [] }` on success, not `{ ok, errors, data: <parsed briefing> }`. This means `repair.js`'s `secondCheck.data ?? repaired.structured` fallback always takes the right-hand side. The tests pass and behavior is correct. If a future task wants the parsed-with-defaults briefing returned, `validateBriefing` should be enhanced to include `data: schemaResult.data` when zod parsing succeeds. Not blocking.

## Subagent dispatch summary

- **Implementers:** 3 dispatches (one per task), all `general-purpose` agents on `sonnet`, all returned DONE on first attempt
- **Spec compliance reviewer:** 0 dispatches (each task is a small focused TDD module with literal code from the plan; no novel decisions)
- **Code quality reviewer:** 0 dispatches (same reason)
- **Manual verification:** read each new file before marking the task complete, ran `npm test` after each task to verify the count progression matched expectations

## Things to watch out for

1. **The schema is more permissive than the prompt will be.** For example, `BriefingSchema` allows `score` to be any number 0–10 (including non-integer values like 7.3), `themes` to be empty (the `array` is required but `min(1)` is not enforced), and `executiveSummary` to be a single character. The synthesis prompt in Batch 5 will instruct the model to produce specific structures, but if the model misbehaves and produces a technically-valid-but-empty briefing, validation will pass and the user will see a bad output. This is a known tradeoff: tighter schema = more frequent repair calls (cost), looser schema = occasional bad outputs that slip through.
2. **The repair prompt mentions only the validation errors** and the allowed paper IDs. It does NOT include the user's profile or the original prompt. This is intentional — the repair pass is a **structural fix**, not a regeneration. If the model invented paper IDs because it misunderstood the user's interests, repairing for citation errors won't fix the deeper issue. Phase 1 acceptance gate (the user reading real briefings for 2 weeks) will catch this kind of failure mode.
3. **`secondCheck.data` is undefined.** See "Known minor" above. If a future change to `validateBriefing` adds a `data` field, the `?? repaired.structured` fallback in `repair.js` will silently start using it instead. That's the desired behavior, but worth flagging in case the change is made and someone wonders why `repair.js`'s output shape suddenly includes zod defaults.

## What's ready for Batch 5

Batch 5 (Tasks 13–16) is the **first user-visible end-to-end synthesis stage**:

- Task 13: write the synthesis prompt template at `prompts/synthesis.md`
- Task 14: create `pages/api/synthesize.js` that loads the prompt, calls `callModel` with structured output, validates with `validateBriefing`, repairs with `repairBriefing`, and returns the briefing
- Task 15: integration test using a fixture-mode synthesis call
- Task 16: create `pages/api/analyze-pdf-quick.js` for compressing a full report into a ~300-word quick summary

This is the **first batch where a real user-visible API endpoint comes online**. After Batch 5, you could in principle hit `/api/synthesize` directly with curl and get a structured briefing back (assuming valid LLM credentials and a real paper list). The UI rendering is still ahead in Batch 6.

**Batch 5 also has the highest risk in Phase 1**: Task 14's synthesis prompt is the only piece of the entire plan whose quality is genuinely unknown until the first real run produces output. The synthesis prompt template itself is in the in-repo plan at §13 (Task 13's content) — it's substantial (~150 lines of editorial-register instructions). The implementer for Task 13 will write it as-spec'd; quality testing happens in Batch 5's integration test (Task 15) and during the Phase 1 acceptance gate.

## Recommendation

**Continue to Batch 5.** All Batch 4 tests passing, lint clean, no outstanding issues. The synthesis stage's input/output contract is now fully specified and validated.
