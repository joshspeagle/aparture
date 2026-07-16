# Aparture Repository Audit — 2026-07-15

**Scope:** full-repo audit across six areas — vision & organization, backend implementation, frontend implementation, UI/UX & documentation, currency (models/APIs/dependencies), and tests & infrastructure — conducted by six parallel audit passes with independent code verification of all high-severity findings.

**Method note:** a large tune-up PR (#5) merged recently, so this audit deliberately dug past surface bugs. Every finding marked _verified_ below was confirmed by reading the actual code; external-currency claims cite their sources. The full suite was run twice during the audit: **883 tests / 115 files, 0 failures, 0 flakes, ~51 s; lint and prettier clean.**

---

## 1. Topline verdict

Aparture is in unusually good shape for a solo beta. The architecture is disciplined (clean `lib/` boundaries, one LLM dispatcher, typed error propagation end-to-end, real path-traversal and SSRF guards), the docs are exceptionally well-written, CLAUDE.md is _actually accurate_ (rare), and the test suite is large, green, behavioral, and fast.

The audit's central observation matches the premise of this exercise: **the vision exists and is mostly load-bearing, but it is stated everywhere except the two places people look first.** README.md carries the real thesis; CLAUDE.md's overview line ("multi-stage arXiv paper discovery + analysis using LLMs") and the docs hero tagline describe mechanism, not purpose. Meanwhile the deepest design rationale lives in gitignored `docs/superpowers/specs/` files that don't exist in a fresh clone, and "Phase 2" — which justifies real code seams — is defined nowhere public.

The four headline gaps, in order of leverage:

1. **No CI.** Nothing runs tests/lint/build on PR or push (only a docs-deploy workflow). PR #5 merged with zero automated verification. The suite is fast and green — CI is nearly free.
2. **One real prompt-corruption bug** (`synthesize.js` cache-prefix construction) that mangles briefing prompts for profiles containing `$$`-style LaTeX — for **all three providers**, not just the Anthropic cache path.
3. **Model registry a generation stale**, including one entry that is now a live 404 (`claude-haiku-3.5` → retired model ID) and defaults resting on Google preview IDs subject to shutdown churn.
4. **The first-run experience ships the author's personal research profile and 20 categories as silent defaults**, and the docs describe a two-gate pipeline while the app ships three — the two things a brand-new user hits first.

---

## 2. Proposed vision statement & design principles (DECISION NEEDED)

> Synthesized from README.md, docs/index.md, environment.md, and the pipeline's actual structure. Pending owner sign-off before being installed in CLAUDE.md / docs.

### Vision

> Aparture turns the daily arXiv firehose into one trustworthy, readable briefing per run — cross-paper editorial synthesis tuned to a single researcher's plain-English profile. It is a single-tenant, local-first tool for working researchers who monitor multiple archives: your keys and state stay on your machine, you stay in the loop at every expensive or judgment-laden step, and your feedback compounds — stars, dismissals, and comments become proposed profile edits, so briefings converge on what you actually want over weeks of use. Every design choice trades toward reader trust and cost proportionality: cheap models triage broadly, expensive models read only what survives, and nothing reaches the page without a grounding check.

### Derived design principles (each already defensible from the codebase)

1. **The profile is the single source of research intent.** Every stage reads `profile.content`; feedback refines the profile via reviewable diffs, never hidden weights. (`hooks/useProfile.js`, `/api/suggest-profile`)
2. **Human-in-the-loop before money and before trust.** Default-on gates precede each cost escalation; every briefing passes a hallucination audit before display. (`lib/analyzer/pipeline.js` gates, `prompts/check-briefing.md`)
3. **Spend proportionally to relevance.** Increasingly capable models over decreasing paper counts; independent model slots; caching, dedupe, and concurrency caps all serve this. (`utils/models.js`, `lib/llm/`, `lib/analyzer/applyDedupe.js`)
4. **Editorial synthesis is the product; per-paper claims must be grounded.** Cross-paper argument is legitimate; numbers/methodology claims are strictly verified; every cited `arxivId` must exist in the input. (`lib/synthesis/validator.js`)
5. **Filter permissively, judge strictly.** Early stages err toward inclusion; later stages re-litigate alignment rather than trusting upstream verdicts. (`prompts/rubric-scoring.md`)
6. **Be a good arXiv citizen.** Serialized, jittered, contact-identified requests; client-side caching; OAI-PMH with v1-anchored windows. (`lib/arxiv/spacing.js`, `lib/arxiv/ingest.js`)
7. **Single-tenant, local-first.** State lives in the user's browser and repo-local files; keys in `.env.local`; `ACCESS_PASSWORD` is a gate, not an identity system. (`docs/reference/environment.md`)

### Placement (to avoid rot-prone duplication)

- Canonical home: a small **`docs/concepts/design-principles.md`** page ("Under the Hood" section), each principle with one line of "where this shows up in the code."
- **README**: keep the existing 3-sentence pitch; add the single-tenant/local-first clause.
- **CLAUDE.md**: replace the mechanism-only overview line with the one-sentence thesis + a link to the principles page. CLAUDE.md keeps only operational contracts (prompt-harmony rules, schema portability rules, color table) — those are correctly placed today.
- **Do not** copy principles into module headers; the existing colocation pattern (e.g. the permissive-filter rule living inside the rubric the model reads) is right — the principles page should _point_ at those sites.

---

## 3. Priority register

Severity reflects impact on the tool's purpose (a researcher's trusted daily briefing) × likelihood. All P0/P1 code claims were independently verified.

### P0 — correctness/safety, fix immediately

| #    | Finding                                                   | Where                                     | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | --------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | **Briefing prompt corruption on `$`-patterns in profile** | `pages/api/synthesize.js:77`              | `cachePrefix` built with string `replaceAll('{{profile}}', profile)` — JS GetSubstitution semantics mean `$$`/`$&`/`` $` ``/`$'` in a profile (LaTeX is likely for this audience) corrupt the prefix; line 94 sends `cachePrefix + fullPrompt.slice(prefix.length)`, so the synthesis prompt is mangled for **all providers** and the Anthropic cache invariant breaks. Fix: function replacement `() => profile ?? ''`, matching `lib/synthesis/renderPrompt.js:12`. Add a `startsWith` assertion like suggest-profile has. |
| P0-2 | **Unauthenticated fixture-mode bypass on 8 LLM routes**   | `pages/api/synthesize.js:50` + 7 siblings | Client-supplied `callModelMode: {mode:'fixture', fixturesDir}` skips the credentials check and makes the server read `<any-dir>/<hash>.json` from its filesystem in production. Bounded (hash-named valid JSON) but it's an unauthenticated route-execution + FS-read primitive. Gate on `NODE_ENV === 'test'` exactly like `_testPdfBase64` (`analyze-pdf.js:286`).                                                                                                                                                         |
| P0-3 | **No CI**                                                 | `.github/workflows/`                      | Only `deploy-docs.yml` exists. Add `ci.yml`: push/PR → `npm ci`, lint, `prettier --check`, `npm test`, `npm run build`, `npm run docs:build`; Node 20+22 matrix. Single highest-value infra fix; the suite is fast and green so this is nearly free.                                                                                                                                                                                                                                                                         |
| P0-4 | **Live-404 model entry + imminent retirement**            | `utils/models.js:39-42,160-167; :31-34`   | `claude-haiku-3.5` maps to `claude-3-5-haiku-20241022`, retired 2026-02-19 — selecting it 404s today. `claude-opus-4-1` retires **2026-08-05** (~3 weeks). Remove both (Haiku 4.5 covers the cheap slot).                                                                                                                                                                                                                                                                                                                    |
| P0-5 | **Dependency vulnerabilities**                            | `package.json`                            | `next` 16.2.4 in a high-severity advisory range (DoS, cache poisoning; first patched release is in 16.3.x — in-range `npm audit fix` does not clear it); high-severity transitive `undici` + `vite` vulns **do** clear via `npm audit fix`. Run the fix now; schedule the Next 16.3.x bump.                                                                                                                                                                                                                                  |

### P1 — significant correctness / trust / first-run issues

**Pipeline correctness**

| #    | Finding                                                                                                                                                                                                                                                                                                                                                    | Where                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| P1-1 | Filter-review gate rebuilds `papersToScore` with hardcoded YES-always/NO-never logic, ignoring `config.categoriesToScore` (which Settings lets users set to any subset incl. NO); pre-gate path honors it exactly. NO-selected papers silently dropped at the gate.                                                                                        | `lib/analyzer/pipeline.js:1601-1614` (verified)                  |
| P1-2 | `setResults` store setter _merges_ object patches, but `handleReset` passes `{allPapers:[],…}` intending replacement and run-start never resets `results` — `availablePapers`/`failedPapers`/`allAnalyzedPapers` leak across resets and runs, corrupting `scoredPaperIds` labeling. Add an explicit `resetResults` action called from Reset and run-start. | `stores/analyzerStore.js:114-119` + `App.jsx:832-854` (verified) |
| P1-3 | Quick-filter client prefers `rawResponse` over server-validated verdicts — the inverse of its three sibling stages. With thinking-enabled Anthropic models, prose preambles trigger the frontend correction loop and bill an extra LLM call per batch despite valid verdicts in hand.                                                                      | `lib/analyzer/pipeline.js:552`                                   |
| P1-4 | `analyze-pdf` funnels **every** direct-download failure (404, timeout, exhausted 429) into the "Playwright unavailable for reCAPTCHA" 422 when Playwright is absent — mislabeled to the user, and `makeRobustAPICall` short-circuits so transient errors never retry. Route to Playwright only on actual reCAPTCHA/HTML detection.                         | `pages/api/analyze-pdf.js:349-361`                               |
| P1-5 | One malformed OAI record (no parseable `<version>`) throws uncaught out of `parseOaiRecord`, aborting the whole prefix harvest and tripping the auto-mode breaker; the Atom path already wraps per-entry. Mirror skip-and-warn.                                                                                                                            | `lib/arxiv/harvestOai.js:190-192`                                |
| P1-6 | Atom fallback inherits the lag-widened window (daysBack+6) but is hard-capped at 300 unpaginated results — for cs.LG-scale categories, the v1 anchor computes from an arbitrary subset and most of the target day silently vanishes. Fetch the target window under Atom (it filters v1 server-side) or split on cap.                                       | `lib/arxiv/fetchAtom.js:15,128` + `pipeline.js:317-324`          |
| P1-7 | Quick-summary fan-out has no retry, no rate-limit barrier, and silently swallows all failures incl. 429 cascades — sparse `quickSummariesById` degrades the check-briefing corpus with no status indication.                                                                                                                                               | `lib/analyzer/briefingClient.js:75-113`                          |

**Model currency (beyond P0-4)**

| #     | Finding                                                                                                                                                                                                                                                         | Where                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| P1-8  | Registry a generation stale on all three providers: missing Claude Opus 4.8 + Sonnet 5; missing GPT-5.6 family (GA 2026-07-09); missing Gemini 3.5 Flash. Stale "most capable"/"frontier" descriptions.                                                         | `utils/models.js`                         |
| P1-9  | App defaults rest on Google **preview** apiIds (`gemini-3-flash-preview`, `gemini-3.1-pro-preview`); Google has already shut down sibling previews. Move defaults to GA models.                                                                                 | `hooks/useAnalyzerPersistence.js:84-99`   |
| P1-10 | Adaptive thinking sent to every `claude-opus*`/`claude-sonnet*`, but pre-4.6 legacy entries (Opus 4.5/4.1, Sonnet 4.5) likely 400 on it (they require `enabled`+budget). Gate on family version or drop legacy entries. _(medium confidence — not live-tested)_ | `lib/llm/structured/anthropic.js:7-11,83` |

**First-run experience & docs drift**

| #     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Where                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| P1-11 | Fresh installs silently ship the author's personal research profile (`DEFAULT_CONFIG.scoringCriteria` seeds `useProfile`) and 20 preselected categories; nothing marks them as examples. Day-one run is large and mistargeted. Ship a bracketed template profile flagged "example — replace me" + 2–3 categories. (Verified.)                                                                                                                                                                                                                         | `hooks/useAnalyzerPersistence.js:32-55`                |
| P1-12 | Gate-count drift across five doc pages: app has **three** default-on gates; `first-briefing.md` narrates two (diagram skips score-review), `reading-a-briefing.md` calls pre-briefing "Gate 2" ×5, `review-gates.md` opens "both gates," `verify-setup.md` promises two pauses. A literal new user concludes the pipeline is stuck at the unnarrated score-review pause. One normalization sweep: Gate 1/2/3 = filter/score-review/pre-briefing.                                                                                                      | `docs/using/*`, `docs/getting-started/verify-setup.md` |
| P1-13 | Assorted doc-vs-app factual drift: `verify-setup.md` button/section names; `reading-a-briefing.md` claims `briefingRetryOnMaybe` defaults on (it's off); `pipeline.md` says the scoring rubric lives in the API route (it's `prompts/rubric-scoring.md`) and `useQuickFilter` is in Settings (config-only); `tuning-the-pipeline.md` slot-table errors (`scoringModel` ≠ Stage 3.5 driver); `install.md` claims dev server fails without keys (it boots; fails at first LLM call); `giving-feedback.md` claims filter rows gain star/dismiss (never). | `docs/**` (each verified by the UX pass)               |

### P2 — quality, performance, UX, a11y

**Performance**

- Render fan-out: `App.jsx` subscribes to high-frequency `processing`/`filterResults` slices and passes fresh function props to a non-memoized `MainArea`; no row memoization, no virtualization — every progress tick re-renders every paper row. First thing to buckle as paper counts grow. (`App.jsx:569-596,1171-1188`)
- Filter success path updates the store once **per paper**, cloning growing bucket arrays (O(n²)); the failure path already batches. (`pipeline.js:592-599`)
- Global jsdom environment on ~60 pure-Node test files ≈ doubles suite wall time; annotate `@vitest-environment node`. (`vitest.config.mjs`)
- Dead derivations `unscoredYes/Maybe/No` computed every render, consumed nowhere. (`App.jsx:1131-1150`)
- tiktoken encoder constructed per call, leaked on throw; memoize + try/finally. (`lib/llm/tokenBudget.js:26-35`)

**Correctness (lower stakes)**

- UTC-vs-local date mismatch: sidebar "Today" never labels today's briefing in UTC+ timezones. One shared date convention. (`SidebarBriefingList.jsx:14-19`, `App.jsx:26`)
- Gate star/dismiss double-toggle: `handleMSStar` toggles both the gate Set and the feedback event — a pre-existing star event gets silently _removed_ while the UI shows starred. (`App.jsx:1012-1048` + `useFeedback.js:57-77`)
- Stop mid-filter leaves `filterResults.inProgress` true forever ("Processing batch X of Y" until reload). (`pipeline.js:432,639` + run-end finally)
- Run-scope feedback input renders under archived briefings but stamps `todayStr()`. (`App.jsx:912-925` + `MainArea.jsx:379-388`)
- Archived briefings show the _live_ run's screened count (`papersScreened={results?.allPapers?.length ?? 0}`); persist it in briefing metadata. (`MainArea.jsx:358`)
- Settings integer inputs can persist `''` via debounced save → `.slice(0,'')` breaks top-N. Clamp at save. (`SettingsPanel.jsx:54-71`)
- Unknown model ID → rate-limit barrier keyed on `''` — 429 cascade protection silently no-ops. (`pipeline.js` + `rateLimit.js:142-150`)
- Synthesize structured-output miss (thinking on → `tool_choice: auto`) has no retry; one text-only response kills the briefing after all pipeline spend. (`briefingClient.js:115-144`)
- `ThemeSection key={theme.title}` — LLM titles can collide. Key by index. (`BriefingView.jsx:60`)
- Atom broad fetches never consult the cache (fill-ups do). (`lib/arxiv/ingest.js:149-177`)
- Password sent in GET/DELETE query strings (logs, history) while POST/PATCH use body; move to a header. (`hooks/useBriefing.js`, `pages/api/briefings/*`, `sessions/*`)
- `checkAccessPassword` uses plain `===`; use `crypto.timingSafeEqual`. (`lib/auth/checkAccessPassword.js:9`)
- Dead `_originalJustification` body field in analyze-pdf — client ships it, route ignores it, rubric has no slot. (`analyze-pdf.js:221`)
- NotebookLM ZIP entry names embed raw arxivId — old-style IDs with `/` nest folders. (`lib/notebooklm/renderPaperReport.js:36-44`)

**Accessibility & UX**

- `--aparture-focus-ring` token defined, consumed nowhere; form primitives set `outline:'none'` — keyboard focus invisible app-wide. One global `:focus-visible` rule. (`tokens.css:34`, `components/ui/*`)
- Verdict pills/ActionPills lack `aria-pressed`/radio semantics; active verdict button is `disabled` (unfocusable); `aria-label` on a role-less div. Briefing PaperCard already does it right — copy that pattern. (`FilterResultsList.jsx`, `ActionPill.jsx`)
- Silent gate arrival: docs advise walking away during Stage 4, then the run parks at a gate with no signal. `document.title` change + optional Notification.
- No in-app cost visibility (registry has no pricing data either — CLAUDE.md's "IDs/pricing" claim is wrong today). Pre-run estimate + post-run cost line.
- Login screen: brand-inconsistent wordmark, "Access Analyzer" legacy copy, no hint that the password is `ACCESS_PASSWORD` from `.env.local` — the documented first stall point.
- No responsive layout (fixed 240px sidebar); briefings unreadable on phones — at odds with the coffee-time reading pitch.
- App never links to its own docs; add contextual links (gates → review-gates, Settings → tuning, login → install#password).
- WelcomeView step 3 describes a per-stage runner that doesn't exist.
- Zero screenshots in docs (one image total, used only by README).

**Tests**

- `MODEL_REGISTRY` ↔ `AVAILABLE_MODELS` consistency invariant unenforced — add a unit test (would have caught P0-4 rot class).
- `App.jsx` reactContext publish contract and `saveBriefingAndSwitch`→`recordRun` ordering (dedupe-index anchor) untested; `MainArea` stage→surface mounting untested.
- Rubric-prompt test writes temp files into the live `prompts/` dir. (`loadRubricPrompt.test.js:14-22`)
- `sweepStaleTmp` (deletes files by pattern on every briefing PATCH) has no direct test.
- One vacuous assertion (`rateLimit.test.js:254`), one placeholder smoke test.
- Pre-push hook runs eslint only; add `npm test` until CI lands.
- Fixtures are hand-authored, never recorded live — provider shape drift is invisible; add a `--record` mode to `smoke-llm-routes.mjs` or document a paid-smoke cadence.

### P3 — organization, hygiene, strategic

- **`cli/` (5,361 lines)** is "scheduled for deletion" but backs 7 npm scripts incl. the canonical `test:dryrun`/`test:minimal` verification path, freezes the `arxivAnalyzerState` schema, has zero automated coverage, and its README misdescribes the product. Write the deletion plan; deprecation-banner the README now.
- Gitignored `docs/superpowers/specs/` cited as design authority for two shipped features; inline the load-bearing decisions or commit sanitized specs. Define "Phase 2" in one committed paragraph.
- Size outliers: `SettingsPanel.jsx` 1,711 lines (largest file, unmentioned in CLAUDE.md), `pipeline.js` 1,982, `App.jsx` 1,477 with an embedded 440-line `PaperCard` that name-collides with `components/briefing/PaperCard.jsx`. Split opportunistically (sections/, per-stage modules, `components/results/RankedPaperCard.jsx`).
- Hardcoded `'gemini-3.1-pro'` default in three frontend sites — export `DEFAULT_MODEL_ID` from `utils/models.js`.
- CLAUDE.md drift: "10 slices" (now 11), stale `components/ArxivAnalyzer.js` docblock refs, plan-relative comment labels ("Phase B-prep chunk 4", "Task 4b"), `#f97316` second undocumented meaning, `APARTURE_REPORTS_DIR` "read by" cell missing session routes.
- Dependency hygiene: playwright 1.56→1.61 (browser age affects both Playwright integrations), lucide-react 0.263 (ancient pin), `node-fetch` droppable (Node ≥20.9 has fetch; only used in `cli/`), tailwind 3→4 not worth it given the near-removed utility layer.
- Strategic options (no action required now): Anthropic `output_config` structured outputs; Google `response_json_schema` (deletes the sanitizer); batch APIs (−50%) for the latency-tolerant filter stage; 1h cache TTL for the Stage-4 PDF loop; NotebookLM Enterprise API as the sturdier Phase-2 path; docs pricing tables vs. no pricing in registry.

---

## 4. Per-area health summaries

**Vision & organization** — Purpose is genuinely documented and load-bearing in docs and code; weakest at the two entry points (CLAUDE.md overview, docs tagline). `lib/` boundaries are principled; `components/` taxonomy fuzzier. CLAUDE.md is accurate but mixes durable contracts with rot-prone migration history. `cli/` is the big drag item.

**Backend** — Disciplined layering, real security guards, correct concurrency primitives (including tricky warmup/abort edges). One real prompt-corruption bug (P0-1), a cluster of pipeline-seam inconsistencies (P1-1…P1-7), all fixable surgically.

**Frontend** — Zustand consolidation and localStorage migration engineering are genuinely strong (the migration guards match their documented semantics exactly). Weaknesses: render fan-out at scale, a store merge-vs-replace semantic trap, uneven a11y (dialogs good, pills bad), invisible keyboard focus.

**UX & docs** — Best-written docs this reviewer has audited for a solo project; journey-ordered IA; honest cost tables. The failures are drift (score-review gate landed without a full doc sweep) and zero visuals. The daily-driver experience outclasses onboarding: author-profile defaults, silent gate arrivals, and no cost visibility are the first-session hazards.

**Currency** — API mechanics all current; model registry one generation behind all three providers with one live 404; defaults on preview IDs; `next` in a vulnerable range. arXiv integration remains fully compliant (over-complies).

**Tests & infra** — 883 behavioral tests, green, fast, no flakes; fixture strategy sound with a loud failure mode; **no CI at all** is the glaring hole, plus a handful of coverage gaps at the seams the architecture leans on (reactContext contract, gate mounting, registry invariant).

---

## 5. Suggested execution plan

Phased so each batch is independently shippable and verifiable:

1. **Batch 0 — safety/currency (small diffs, high stakes):** P0-1, P0-2, P0-4, P0-5 (`npm audit fix` now; Next 16.3.x bump as its own commit), plus P1-9 default-model switch.
2. **Batch 1 — CI:** `ci.yml` (tests, lint, prettier, build, docs build; Node 20/22), pre-push `npm test`, registry-invariant test, delete placeholder/vacuous tests.
3. **Batch 2 — pipeline correctness:** P1-1…P1-7 with regression tests each.
4. **Batch 3 — vision install + docs sweep:** design-principles page, CLAUDE.md/README/index reframing, gate-numbering normalization, factual-drift fixes (P1-12/13), Phase-2 paragraph, cli/ deprecation banner.
5. **Batch 4 — first-run UX:** neutral starter profile + honest defaults (P1-11, pending decision), login-screen copy, WelcomeView fix, contextual doc links, gate-arrival title change.
6. **Batch 5 — quality pass:** focus ring + pill a11y, memoization of hot rows, store `resetResults`, date-convention unification, password-to-header, remaining P2s.
7. **Later / opt-in:** SettingsPanel/pipeline/App splits, screenshots pass, worked tutorial, cost estimator, responsive layout, cli/ deletion plan execution.

---

## 6. Decisions needed from the owner

1. **Vision statement & principles (§2)** — adopt as drafted, or edit? (Notably: is "single-tenant, local-first" a permanent commitment or just a current stance pre-Phase 2?)
2. **Default profile/categories (P1-11)** — replace the author's personal defaults with a marked example template + minimal categories? (Changes first-run behavior; author's own instance keeps its saved config.)
3. **Model registry refresh (P1-8)** — which new models to add and which default tier to prefer (cost posture is opinionated: e.g., Sonnet 5 vs. Opus 4.8 as flagship recommendation; keep or drop legacy Anthropic entries entirely).
4. **CI scope (P0-3)** — plain test/lint/build workflow, or also coverage reporting + docs-build PR check?
5. **`cli/` (P3)** — deprecation banner now + deletion plan, or actual deletion this cycle (requires reassigning `test:dryrun`/`test:minimal` entry points)?
