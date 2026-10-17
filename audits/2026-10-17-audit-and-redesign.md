# Aparture audit and redesign, 2026-10-17

_A point-in-time report, kept as provenance like `2026-07-15-repo-audit.md`. It is the before picture for the changes on branch `claude/aparture-audit-redesign-r4i5i0`, plus four design memos answering the owner's questions. Audit evidence is against commit `1a35da8`; measurements of the skill prototype are from a live run on 2026-10-17._

## Summary

**The mission holds. The product doesn't yet deliver it.** "Stop skimming the arXiv without worrying about what you're missing" is the right job. Today's listings show why: 1,020 new papers in the owner's 19 categories, of which triage kept 279 and 12 were worth reading in full. The app falls short in three ways:

- **It hides what it learns.** Findings, numbers, caveats and figures are extracted, then left in a side panel or never shown.
- **It shows nothing below the cut,** so the reader can't confirm the rest of the day was safe to skip.
- **Its checks are narrower than its docs claim.** In a probe, the validator accepted 5 of 5 deliberately broken briefings.

**Recommendation: go skill-first, keep a deterministic harness, and don't build Electron.** A frontier model working from a `SKILL.md` did the reading and writing for today's live briefing (§4): triage, full-text deep reads, the editorial argument. Code did everything that should not be a judgment call: harvest, dedupe, verbatim-quote and citation validation, rendering and feedback merge. An independent claim audit flagged 11 problems across two rounds. All 11 were fixed before publication. The result is richer and better grounded than anything the app's pipeline can produce today. It is also more expensive per run (§4.4). Run it side by side with the app for two to three weeks before retiring anything.

**Memory: split it in two and make feedback part of reading.**

- Your profile stays in your words and changes only when you accept a proposal.
- A second file, `learned.md`, holds the editor's short, dated, evidence-backed notes.
- Each briefing ends with "Notes from the editor": at most two tap-to-answer questions and three proposed edits, each with its evidence.
- Every paper card carries star, dismiss, "already knew it", comment and "ask about it" controls.

**Multimedia: use real figures, never generated infographics; make audio grounded and opt-in.** For figures and links:

- 97% of new arXiv papers have an HTML version. Their figures are the authors' own and are checkable by construction.
- The prototype embeds the key figure when the license allows and links it otherwise.
- alphaXiv gets a plain link only; its terms forbid scraping.

For audio:

- NotebookLM, now Gemini Notebook, has no consumer API.
- Its enterprise API cannot download audio, and its podcast API is closed to new customers.
- A grounded podcast instead means a validated two-host script plus Gemini 3.8 Flash TTS, at about $0.25–0.35 per 10-minute episode.

**Persistence: put state in files and add a scheduler, not a desktop shell.** The clunk is architectural. The pipeline runs in the browser and its state lives in localStorage, so unattended runs need `cli/` to drive a visible Chromium through the UI. A headless core over plain files serves both the skill and the web app. Electron adds a release-and-signing treadmill and fixes none of that.

**On this branch (§6–7):** all 8 P0 findings and all 17 P1s are fixed, with 1,471 tests passing.

**Decisions for you are in §8.** The first one: start the side-by-side trial. It needs a private state repo and a scheduled routine, both of which I left for you to approve.

---

## 1. Is the project well motivated?

Yes, and today's numbers make the case better than `POSITIONING.md` does.

| 2026-10-17, owner's profile and 19 categories                                  | Count |
| ------------------------------------------------------------------------------ | ----- |
| New papers harvested (one announcement day, plus fill-ups for thin categories) | 1,020 |
| Kept by triage (YES 93, MAYBE 186)                                             | 279   |
| Read in full                                                                   | 12    |
| Read-tier papers in the briefing                                               | 3     |

Nobody skims 1,020 abstracts a day. The four alternatives in `POSITIONING.md` stop short where it says they do:

- ranked feeds rank but don't read;
- query tools synthesize per question;
- DIY scripts summarize but don't check;
- platform assistants brief but can't be audited.

The three claimed differentiators are real: one editorial briefing, validation before display, and legible personalization that grows.

The gap is delivery. Three findings from the briefing audit (§6) bear directly on the mission:

1. **"Safe to skip" is asserted, never shown.** The app renders about 30 uniform cards and nothing below the final cut. The reader sees no funnel and no near misses, so has no way to trust the skip. The prototype's masthead reads "1,020 papers screened · 279 kept by triage · 12 read in full". Below the papers it lists the 15 that nearly made it.
2. **The newsletter material is hidden.** The pipeline extracts findings, numbers, limitations and figures, then shows a pitch and a paragraph on why the paper fits the profile. The reader can usually guess the second part. Authors, venue and code links never reach the card.
3. **The checks are narrower than the docs say.**
   - The validator only tests that cited IDs are in the input set.
   - The audit runs on the same model that wrote the briefing.
   - It sees full reports cut at 4,000 characters.
   - It leans toward MAYBE, which doesn't trigger a retry by default.
   - A YES after retry still ships.

   Design principle 4 says a failing briefing "is repaired or retried before you see it". That holds only for the ID check. (Branch B fixes several of these; see §7.)

None of this argues against the mission. It argues for a briefing that shows its reading and proves its claims. That is what the redesign in §§2–5 does.

---

## 2. Memory and feedback

### 2.1 What exists

The profile is the tool's only durable memory: a plain-English document the user wrote. Feedback has six event types (star, dismiss, paper comment, general comment, filter override, scoped feedback) and is stored in localStorage. `/api/suggest-profile` turns accumulated feedback into a proposed rewrite with per-change rationales, but only when the user opens the dialog and asks.

The audit found the loop leaking in several places. Fixes are in progress on branch A (§7):

- **Paper comments never reached synthesis.** Synthesis looked for a field the events don't have, so the "stars anchor themes, comments are woven in" behavior the prompt promises could not happen.
- **Dry-run feedback pollutes the real profile.** Test runs write real feedback events.
- **Named-profile snapshots go stale.** A named profile could be saved from stale content.
- **Briefing-card stars send an empty summary** into suggest-profile.

### 2.2 Why one memory slot isn't enough

Everything the tool learns has to be written back into the profile, and the profile is in the user's voice. That forces a bad trade:

- **Rewrite eagerly:** the profile drifts away from the owner's own words and grows by accretion.
- **Rewrite rarely:** feedback has no effect until the owner remembers to open the dialog.

Today's design takes the second branch, which is why the loop feels inert.

### 2.3 Proposed design (implemented in the skill prototype)

**Two layers of memory, both plain text:**

| File             | Holds                                                                                                                                   | Changes when                                                                           | Read by               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------- |
| `profile.md`     | The owner's interests, in their words                                                                                                   | Only when the owner accepts a proposal                                                 | Every stage           |
| `learned.md`     | The editor's notes: one dated line each, each citing its evidence ("prefers methods papers with a real-data test; answered 2026-10-17") | The skill appends a note when evidence is strong; stale notes are proposed for removal | Triage and the writer |
| `feedback.jsonl` | Append-only events: star, dismiss, already-knew, comment, answer, proposal decision                                                     | Every tap on the page                                                                  | The proposal step     |

`learned.md` absorbs the fast-moving signal. The profile stays short, stable and recognizably yours. A note can be read, edited or deleted in a second. That keeps the "nothing about your preferences is stored anywhere you can't read and edit" principle.

**The briefing is the feedback surface.**

- Each paper card has star, "not for me", "already knew it", comment, and an "ask about it" box that answers questions about that paper from inside the page.
- Feedback becomes a by-product of reading instead of a chore in a separate panel.
- The taps land in the page's own store. The next run imports them with `aparture ingest`, deterministically and idempotently.

**Proactive, but never silent.** Each briefing ends with "Notes from the editor":

- **`learned`:** one sentence on what changed because of recent feedback ("Since you dismissed three LLM-evaluation papers last week, those now need a methods contribution to make the cut"). It is empty when nothing changed.
- **Up to two questions,** asked only when the day exposed a real ambiguity. Each has two to four tap answers. Today's two:
  - _Five methods papers lost ground in the full read because their evidence stops at simulations or low-dimensional benchmarks. Should a methods paper need a test on real data?_
  - _No galaxy-formation paper made the list; the closest scored 7.1 against a cut of 7.4. Should one slot go to galaxy formation on days like this?_

  Questions are the low-risk proactive channel. Ignoring one costs nothing, and an answer is unambiguous evidence.

- **Up to three proposed edits** to `profile.md` or `learned.md`. Each is an insert, replace or delete anchored to verbatim text, which the validator checks. Each lists its evidence (paper IDs, answer dates), and acceptance is one tap.
  - Today's briefing has none. There is no feedback yet, and a proposal without evidence would be invented.
- **"Because" lines on papers** ("here partly because you starred 2610.xxxxx"). The validator checks them against the feedback log, so the briefing cannot claim a memory it doesn't have.

### 2.4 Why this should be enjoyable

The enjoyment has to come from the reading, not from gamification. Concretely:

- **Every tap shows up the next morning.** Feedback should feel heard: the `learned` sentence and the "because" lines are where it shows.
- **Questions are about your research, not about the tool.** "Do you want stellar-stream papers that don't use Gaia?" is worth answering. "Did you like today's briefing?" is not, and the skill is told never to ask it.
- **Nothing changes behind your back,** and everything is reversible. Proposals carry evidence. The state directory can be a git repo, so every accepted edit has history.
- **The briefing can be questioned.** The "ask about it" box turns a report into a conversation without leaving the page.

### 2.5 Bringing it to the app

1. Land branch A's fixes. **Done** (`e8ff6bd`; §7).
2. Add an "editor's notes" step after synthesis: a small route with its own schema (`learned`, `questions[]`, `proposals[]`), so the synthesis schema and its fixtures stay untouched. Render the notes at the end of `BriefingView`. Add `answer` and `proposal-decision` to `useFeedback`. **Done for questions** (`b32ce71`): `/api/editor-questions` asks up to two, and answers are `answer` events with their own suggest section. `learned` and `proposals` are still to come.
3. Run suggest-profile proactively once enough new feedback has accumulated (for example, five events since the last proposal). Its output becomes the next briefing's proposals instead of waiting in a modal.
4. Give `useProfile` a second slot for `learned.md`, shown as a "What Aparture has learned" tab beside the profile.

---

## 3. A newsletter, not a ranked list: figures, links, audio

### 3.1 Figures and links: do now

- **arXiv HTML is nearly universal.** 97% of new submissions have an HTML version. All 72 figures in an 8-paper research sample, and every figure in today's 12 papers, resolved to a fetchable image with its caption.
- **Real figures are honest by construction.** A real figure is checkable in a way no generated image is.
- **The model picks, code renders.** The deep-read report names a `keyFigure` with a reason. The writer picks it, and code renders the image with its verbatim label.
- **The arXiv license gates reuse:**
  - CC BY, BY-SA and CC0 figures are embedded.
  - Figures under arXiv's default non-exclusive license get a link. That covered 1 of today's 3 read-tier papers.
- **SVGs go through `<img>`, never inline** (inline SVG can run script).

The links row on every card is Abstract · PDF · HTML · alphaXiv. Each link source is used only where it adds something:

- **alphaXiv:** link only. Its terms forbid scraping, and on day zero its pages are empty anyway, but readers can request an overview or join discussion there.
- **Hugging Face Papers:** only useful for ML-adjacent papers. It covered 0 of 138 astro-ph papers in the sample.
- **Semantic Scholar:** citation counts are always zero on day zero, so it adds nothing to a daily briefing. It is worth revisiting for "who cites the papers you starred three months ago".
- **Code links:** these come from arXiv comments and abstracts (14% of cs.LG papers), then the HTML body. The OAI `arXivRaw` record already carries `comments` and `license`. `lib/arxiv/parseOaiRecord.js` drops both, a one-line fix that is still open.

### 3.2 Audio: grounded, opt-in

**What changed at Google:**

- **The rename.** NotebookLM was renamed Gemini Notebook on 2026-07-16.
- **No consumer API.** Automation of the consumer product (Aparture's Playwright driver, the unofficial `notebooklm-py`) breaches Google's terms on reverse engineering and automated access, and breaks without notice.
- **The enterprise API can't hand audio back.** It is a v1alpha preview that can create an audio overview but has no endpoint to download it, so nothing can be pulled back into the archive.
- **The podcast API is closed.** The standalone Podcast API is deprecated and not taking new customers.

**What works:** generate the episode ourselves and check it like the briefing.

1. An LLM writes a two-host script as structured JSON, with every turn listing the arXiv IDs it cites. The outline reuses the existing discussion-guide pruning rules, so the briefing's editorial choices still win.
2. The validator checks cited IDs, word budget and speakability (no TeX, no URLs). Optionally the claim audit runs on the script.
3. **Gemini 3.8 Flash TTS** renders it:
   - native two-speaker output;
   - about 10.9 minutes per request;
   - it uses the existing `GOOGLE_AI_API_KEY`;
   - it ranks fifth in the independent Speech Arena.
4. MP3, chapters linking each paper and a transcript are archived beside the briefing. A local RSS feed puts the episode in a podcast app.

| Route                            | Cost per 10-minute episode                                                 |
| -------------------------------- | -------------------------------------------------------------------------- |
| Gemini 3.8 Flash TTS plus script | about $0.25–0.35, about $0.40 after Google's January 2027 TTS price change |
| ElevenLabs v4 (best voices)      | about $0.90–1.00                                                           |
| Gemini Notebook by hand          | about $0.03 plus clicking                                                  |

Twenty-two weekday episodes on Gemini cost about $5–7 a month. Keep the NotebookLM ZIP export as the manual alternative. Add an "import media back" drop target so a hand-made Gemini Notebook audio file or slide deck can be archived beside the briefing, labelled as unaudited.

### 3.3 Visuals: deterministic only

Generated scientific infographics are wrong precisely where researchers look. In one 2026 study, 99 of 100 infographics from Google's top image model (Nano Banana Pro) had at least one misleading element. Gemini Notebook's infographics are built on that model. A plausible wrong diagram in a briefing whose selling point is checkability is worse than none.

Worth building instead, drawn from data the pipeline already has:

- the funnel (fetched, filtered, scored, read, briefed);
- the score histogram;
- the category and theme mix;
- a theme-to-paper map.

---

## 4. Skill-first?

### 4.1 Verdict

Yes, as a hybrid, not a pure prompt. Make the skill the primary way to run Aparture, with code doing everything that should not be a judgment call. Run it next to the existing pipeline for two to three weeks on the same profile, then decide which one you read.

A pure skill would throw away the differentiator. `POSITIONING.md` faults platform assistants for "opaque sourcing, no citation checks, no reproducibility". A model asked to "please check your citations" is exactly that. The hybrid keeps the checks in code, where a failed check stops publication.

### 4.2 What was built and run today

- **`.claude/skills/aparture/`:** a `SKILL.md` plus seven reference files, mirrored at `.agents/skills/aparture` so Codex, Gemini CLI, Cursor and Copilot can load it.
- **`bin/aparture.mjs`:** a headless runner reusing the app's own arXiv code in-process. Its commands:
  - `fetch`: OAI-PMH harvest, v1-anchored window, fill-ups, dedupe;
  - `enrich`: arXiv HTML to Markdown plus figures, 15 s apart per arXiv's robots.txt;
  - `validate`;
  - `render`;
  - `record`;
  - `ingest`.
- **`lib/briefing/v2/`:** the newsletter-shaped briefing format, with its schema, validator, renderer and feedback import.

The validator checks, in code:

- every paper is in the reading set and every near miss came from triage;
- every title matches arXiv;
- every quoted sentence appears verbatim in the paper's own text;
- every figure ID exists;
- every "because" reference is in the feedback log;
- every proposal's anchor is in the file it edits;
- every paper sits in a theme.

**Today's run:**

1. **Harvest:** 1,020 papers over OAI-PMH.
2. **Triage:** 8 parallel workers of about 128 abstracts each, returning scored JSON.
3. **Selection:** the top 12, with a 15-paper near-miss list.
4. **Enrichment:** 12 HTML texts of 3,400–22,600 words, and figures.
5. **Deep reads:** one worker per paper, reading the full text and quoting it.
6. **Writing, validation and audit.** The briefing passed the validator first time. The claim audit, run by an independent worker against the full texts, returned:
   - **round 1, YES (9 flags):** 2 method details contradicted by the papers, 7 dropped qualifiers or stretched scopes;
   - **round 2, MAYBE (2 flags):** two problems round 1 had missed.

   All 11 were fixed and the briefing re-validated.

7. **Publish:** a private page with working feedback storage (verified by a read-back): [the 2026-10-17 briefing](https://claude.ai/artifact/KAnkgytTTTwUraBucobZy2).

Two lessons went back into the skill:

- **Most audit flags were scope lost in compression,** not invention.
- **One audit round is not exhaustive.**

### 4.3 Quality signals

- **The deep reads were skeptical.** 11 of 12 papers scored lower after the full text than at triage (mean drop 0.5 points), each with a stated reason. Examples:
  - "every non-iid test is a unimodal Gaussian";
  - "the 13× saving belongs to the whole pipeline";
  - a 2.8σ slope from four bins.

  The app's abstract-level scores can't do that.

- **The read-first pick was editorial, not the top score.** The briefing chose a hierarchical reverberation-mapping paper (7.6) over the top-scoring conformal-MCMC paper (7.8). It hits both the statistics and survey-science lines and reuses nested samples. That is the judgment a ranked list can't make.
- **Every quoted result is verifiable,** and the page says so on each card.

### 4.4 Cost, honestly

- **The run isn't cheap, and I can't separate its cost cleanly.** The same session also ran about 35 agents for the audits, research and fixes, plus this conversation. The run's workers ended with about 4.5 million tokens of context between them, re-read on every turn. From that and current list prices:
  - a run like today's costs roughly **$30–50 at API rates**, with deep reads at maximum effort on the frontier model;
  - a tuned daily configuration should cost roughly **$10–20**;
  - the structured pipeline costs **$1–2** per run on Gemini defaults.
- **Tuning means three changes:**
  - triage on the smallest current model, about a twentieth of the mid-tier price;
  - deep reads on the mid-tier model;
  - 6–8 deep reads on ordinary days.
- **On a subscription there's no per-run bill,** but the run draws on the same usage limits as everything else you do.
  - This session hit its five-hour limit about 70 minutes in.
  - The skill run shared that window with about fifteen other agents, so it was only a fraction.
  - A daily run at this depth is still a real share of a plan.
- **Measure before scheduling.** A routine runs in its own session and reports its own usage, so a week of trial runs gives clean numbers. Anthropic's support pages also say Max plans include $100–200 a month of API credits. If so, they would cover the structured pipeline's API costs. I haven't checked that against a bill.

### 4.5 What you gain and lose

| Gain                                                      | Lose                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Full-text reading with figures; skeptical deep reads      | Per-stage, cross-provider model slots                                                                     |
| Verbatim-quote checks against the paper, not LLM notes    | BYOK keys and exact per-stage cost display                                                                |
| Less code for judgment steps; model upgrades for free     | Grammar-constrained output (becomes validate-and-retry)                                                   |
| Portable across agent products (`SKILL.md` is a standard) | Zero-cost fixture tests for the judgment steps (the deterministic core keeps them)                        |
| A briefing that can be questioned in place                | Interactive gates (they become asynchronous)                                                              |
|                                                           | Local-first privacy, if run as a cloud routine (state lives in claude.ai and GitHub under consumer terms) |

**Platform risks, all checked as of today:**

- Routines are a research preview, with a one-hour minimum interval.
- arXiv is not on the default cloud network allowlist. A Custom environment must allow `arxiv.org`, `export.arxiv.org` and `oaipmh.arxiv.org`.
- Whether the artifact database is reachable from a routine session is untested.
- Third-party apps may not sign users into their Claude subscription, so distribution means "template repo plus skill", not an app.

### 4.6 Repository shape if the skill wins

```
aparture/
  .claude/skills/aparture/      the product: SKILL.md + references (+ .agents mirror)
  bin/aparture.mjs              deterministic CLI: fetch, enrich, validate, render, record, ingest (+ run, schedule)
  lib/                          shared core: arxiv, briefing v2, feedback, llm adapters
  prompts/                      rubrics shared by the skill and the app
  pages/, components/, hooks/   the web app: viewer and editor over the same state, plus "API mode"
  docs/
```

State lives in one directory, either `~/aparture/` or a private git repo for cloud routines. It holds `profile.md`, `learned.md`, `feedback.jsonl`, `seen.json`, `briefings/` and `runs/<date>/`. Both front ends read and write the same files, so memory is shared whichever way a run happens.

---

## 5. Persistence and the long-running app

### 5.1 Why it's clunky

- **The pipeline lives in the browser.** Stage modules call relative `/api/*` URLs and read the Zustand store.
- **Durable state is split.** It sits between browser localStorage and repo-local `reports/`.
- **So headless runs drive the browser.** Nothing can run without the browser, so `cli/` (about 5,400 lines) starts `next dev`, opens a visible Chromium and drives the UI. Its test scripts couldn't even find their own modules until this branch.

### 5.2 Options

|                          | Electron                                                        | Headless core + scheduler       | Hybrid skill (on that core)              |
| ------------------------ | --------------------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| Runs with laptop closed  | No                                                              | No (unless on an always-on box) | Yes (routine), or no (local `claude -p`) |
| Keeps today's guarantees | All                                                             | All                             | Most (§4.5)                              |
| Build effort (solo)      | 10–20 person-weeks                                              | 4–8                             | 3–6 after the core                       |
| Maintenance              | High: Electron majors every 8 weeks, signing, per-OS installers | Low                             | Low-medium                               |

Tauri needs a static Next.js export plus a Node sidecar. A PWA can't fetch OAI-PMH, which sends no CORS headers, and can't run reliably in the background. Neither is worth it.

### 5.3 Plan

1. **Files first.** Move profile, named profiles, feedback, config and the seen-papers index to the state directory. Small API routes serve them, and localStorage migrates once. The web app becomes a view over the same files the skill uses. This is the step that pays twice.
2. **`aparture run`:** the existing API pipeline, headless.
   - `createAnalysisPipeline` with the in-process route shim from `lib/headless/` and a file-backed store.
   - Gates become `auto` or `async`.
3. **`aparture schedule install`:** launchd, systemd-user or Task Scheduler templates, with a completion notification.
4. **Delete `cli/`** once 2 and 3 work.
5. **Electron only if the audience changes** to non-technical researchers, and then as a thin shell over this core.

---

## 6. Audit findings

_Four code-audit passes (backend **be**, tests and infrastructure **ti**, docs and CLAUDE.md **ds**, frontend and UX **fu**) and the briefing-product pass produced 55 deduplicated findings against `1a35da8`. A tag like [be P1-1] cites a report and item; evidence lines are at `1a35da8`. Status is as of this branch's last commit._

**All 8 P0s and all 17 P1s are fixed. Of the 30 P2 and P3 findings, 14 are fixed and 4 partly.**

<!-- prettier-ignore -->
| ID | P | Area | Finding | Evidence (at `1a35da8`) | Fix | Status |
|---|---|---|---|---|---|---|
| B1 | P0 | pipeline | **Stop doesn't stop.** Stages re-read `abortControllerRef.current`, so after Stop→Start the old run adopts the new signal and bills a second pipeline (the probe saved 2 briefings). Stop alone still finishes the fetch, wipes the last `finalRanking` and reports "Check your API configuration". | `startProcessing.js:96,372-395`; `harvestOai.js:26-30` (no signal), `:212`; `fetchPapers.js:59-68` [be P1-1] | Per-run `{id, signal}` via deps; guard writes and `finally`; abortable fetch and sleeps | fixed (`5018a50`); calls already sent still finish |
| B2 | P0 | security | **LAN-reachable with a weak gate.** `next dev`/`start` bind 0.0.0.0. Any `apiKey` string skips the password, so analyze-pdf fetches arXiv PDFs and launches Chromium before the provider rejects the key. Password attempts are unthrottled. | `package.json` dev/start (unchanged at 0926dfc); `resolveRouteAuth.js:58`; `analyze-pdf.js:243-253,295-416` [be P2-9; ti P0-2] | `-H 127.0.0.1`; require the password on arXiv/Playwright routes; attempt limiter | fixed, gap left (`5018a50`): no password-attempt limiter |
| B3 | P0 | persistence | **Briefings are deleted.** History is a 90-entry cap, not 90 days, and rotation unlinks `reports/briefings/<id>.json`. Test runs also save, so past 90 each dry run deletes a real briefing. Docs and CLAUDE.md promise a "90-day rolling window" and a "permanent record". | `useBriefing.js:8,380-389`; `briefingClient.js:541`; `reading-a-briefing.md:106`; `troubleshooting.md:246`; `CLAUDE.md:44` [be P2-11; ds A1-5, C-P1-1] | Never unlink on rotation; trim test runs first; fix docs | fixed (`5018a50`) |
| F1 | P0 | feedback | **Paper comments never reach the synthesizer.** The client reads `e.comment`; events store `e.text`. The card still lists the comment as if it was used. | `briefingClient.js:43-44` vs `useFeedback.js:111-127` [fu P0-1] | Read `e.text`; test `engagement.comments` | fixed (`e8ff6bd`) |
| F2 | P0 | feedback | **Dry runs write fake feedback.** Each one writes about 15 invented overrides ("filter said 123, user changed to NO") into real memory, pre-ticked in Suggest. Dry-run stars and notes are unflagged too. | `mockApi.js:99` (`verdict: 123`); `quickFilter.js:222-236` (no enum check); `scoreAbstracts.js:45-58` (bucket diff) [fu P0-2; be P3] | Record on click; validate the enum; stamp `testMode` | fixed (`e8ff6bd`, `e2b9df7`) |
| F3 | P0 | profile | **Named profiles lose the real one.** After "Save as…", switching back to Default loads the seed snapshot (the bracketed template) over the real profile. Commits never write through to `profiles[active]`. | `useProfile.js:316-336` (saveAs), `:182-269` [fu P0-3] | Write through on commit; snapshot the outgoing profile in saveAs | fixed (`e8ff6bd`) |
| T1 | P0 | tests | **Suite red since 2026-08-09.** 9 of 1177 `useSeenPapers` tests use May fixture dates that the 90-day prune ages out, and pre-push blocks every push. | `useSeenPapers.test.js:44,54,108,119,207,245,295,377,421`; `useSeenPapers.js:37,80-89` [ti P0-1] | Fake only `Date`; pin May 2026 | fixed (`9810912`) |
| T2 | P0 | deps | **next@16.2.10 has critical/high advisories** (RCE in the image optimizer and next/og; SSRF below 16.3.8). `/_next/image` was on though unused. `npm audit fix` crashes on npm 10.9.4. | Prod audit: 6 (1 critical, 4 high, 1 moderate); no `images` block in `next.config.mjs` [ti P0-2] | next ≥16.3.8; `images.unoptimized` | fixed (`0926dfc`) |
| B4 | P1 | pipeline | **`refusalPolicy:'fail'` never halts.** The pool swallows task errors, so a refused filter batch vanishes from every bucket with `errors=[]`. The PDF stage doesn't record the refusal, and the test never asserts a halt. | `rateLimit.js:345-350`; `analyzePDFs.js:252-254,309-321`; `pipeline-refusal-policy.test.js:227-250` [be P1-2] | Pool fatal channel; record before the generic path | fixed (`5018a50`) |
| B5 | P1 | LLM | **No structured-output guarantee on thinking models.** On Anthropic thinking models (all current Opus, Sonnet and Fable), a text-only repair 500s and a text-only check becomes `null`. Unregistered `claude-fable-5-1`/`claude-haiku-5-5` got a forced `tool_choice` (400). | `anthropic.js:13-36,104-129`; `repair.js:32-33` [be P1-3, P2-3; ti §6] | `output_config.format` json_schema | fixed (`504fb65`) |
| B6 | P1 | briefing | **The validator only checks that cited IDs are inputs.** Prose IDs go unchecked, and title/score come from the LLM, so a valid link can carry another paper's title. Dropped, starred and unthemed papers pass. Docs say "validation rejects… repair pass runs". | `validator.js:15-36`; `BriefingView.jsx:71-73`; `briefing-anatomy.md:102`; `reading-a-briefing.md:40` [be P1-4; ds C-P1-2] | Overwrite title/score; check prose IDs and coverage; salvage, not 500 | fixed (`5018a50`) |
| B7 | P1 | briefing | **Audit failures are silent.** A non-OK or non-JSON claims check becomes `null`, and the briefing saves with `hallucinationCheck:null` and no status line. | `briefingClient.js:295-306,476,510` [be P2-7] | Status line, a "not audited" badge, one retry | fixed (`b1178b3`) |
| T3 | P1 | cli | **The documented verification path is broken.** `cli/` (5,363 lines) can't finish a run, yet `CLAUDE.md:19-20` and `cli/README.md:3` name `test:dryrun`/`test:minimal` as the way to verify. Login clicks "Access Analyzer" (now "Unlock"), other selectors are stale, and gates are unhandled. | `cli/browser-automation.js:300,554-610`; `App.jsx:1012` [ti P1-2; ds A1-1, C-P1-3; be §6] | Delete `cli/` and its 7 scripts; document `npm test` | fixed (`c860609`): `cli/` removed; `bin/aparture.mjs` and the skill cover unattended runs |
| T4 | P1 | CI | **No scheduled CI or dependency monitoring**, so both P0s arrived with zero commits. Node 20 (EOL) was still in the matrix. | `ci.yml:8-10,19`; no `dependabot.yml` [ti P1-1, P2-4] | Cron; prod audit gate; Node 22/24; Dependabot | fixed, gap left (`0926dfc`, `4e25269`): no coverage floor; actions still @v4 |
| T5 | P1 | tests | **Tests can't see the App shell or the clock.** Deleting `recordRun` (`App.jsx:231`), dropping `seenPapersIndex` (`:254`) or parsing local time (`:230`) all pass 1177/1177. The TZ tests can't fail in UTC CI. | Mutations M1-M3, M11; `briefingClient.test.js:415`; MainArea and RefusalSummaryCard at 0% [ti P1-3, P1-4] | App-level dedupe tests; per-file `TZ`; coverage floor | fixed (`4e25269`): App-level dedupe tests and a UTC+14 CI pass; no coverage floor |
| D1 | P1 | CLAUDE.md | **Nine claims lead an agent to a wrong action** (listed below the table). | ds A1 rows 1-9 | Fix them; add the Vitest, hooks and CI facts | fixed (`a12e721`) |
| D2 | P1 | CLAUDE.md | **(new) CLAUDE.md documents the removed tool path.** It still prescribes the strict `tool_use` + `tool_choice` path that 504fb65 removed, and an Opus/Sonnet-only thinking fallback. Following it brings forced `tool_choice` back. | `CLAUDE.md:29,166,288-290` vs `anthropic.js` | Describe `output_config` and the wider fallback | fixed (`a12e721`) |
| F4 | P1 | feedback | **Unticking an event in Suggest discards it.** The cutoff is the newest selected timestamp, so older unticked events, and those behind rejected or "no change" results, show "Already incorporated". | `SuggestDialog.jsx:283-286,307-311`; `FeedbackTimeline.jsx:55-56` [fu P1-1] | Track incorporation per event | fixed (`e8ff6bd`) |
| F5 | P1 | feedback | **Post-run overrides are dropped.** The pills re-enable, but override events are written only when scoring starts. | `FilterResultsList.jsx:293-294`; `App.jsx:463-482` [fu P1-3] | Record on click | fixed (`e8ff6bd`) |
| F6 | P1 | feedback | **The Gate 3 note never reaches synthesis.** "Lead with the diffusion-models cluster" is saved with `briefingId: undefined`, and `callSynthesize` posts only the profile, papers, provider and model. | `PreBriefingGate.jsx:16-17,84`; `briefingClient.js:211-217` [fu P1-4] | Send it as editorial instructions | fixed (`e8ff6bd`) |
| F7 | P1 | first run | **A run without a key fails badly.** "+ New Briefing" doesn't navigate. Each batch retries 4 times with "missing credentials" and no env-var name. Suggest says "missing apiKey or password" even with a valid password. | `App.jsx:369-372`; `suggest-profile.js:162` [fu P1-8, P2-13] | Navigate; run validate-setup automatically; name the variable | fixed (`5581925`; fail-fast in `5018a50`): setup is not validated automatically |
| F8 | P1 | gates | **Gates are buried and mis-signalled.** They render inline on one page (Gate 2 is ~3,700 px down) with no scroll or announcement. The timeline shows `*-review` as running ("Filtering papers..." beside Pause and Stop). | `MainArea.jsx:216-320`; `ProgressTimeline.jsx:19-25` [fu P1-9] | Scroll to and announce the gate; show "waiting" | fixed (`6d59674`) |
| F9 | P1 | mobile | **Phone layouts break.** At 390 px, ranked cards squeeze to ~120 px (one word per line) and filter titles wrap word by word. The full-report panel is a fixed 55% (~215 px) and prints raw markdown. | `RankedPaperCard.jsx:394-430`; `FullReportSidePanel.jsx:21,44-48` [fu P1-10, P2-7] | Stack pills below 768 px; full-screen panel | fixed (`013c25e`) |
| F10 | P1 | a11y | **Status colours fail contrast.** In the default light theme: diff 1.84:1 and 2.88:1, amber 1.90, green 2.02; pills at 10 px. Settings inputs are unlabelled, and Enter on a sidebar Archive icon navigates. | `DiffPreview.jsx:107-143`; `settings/shared.js:14-53`; `SidebarBriefingList.jsx:190` [fu P1-11, P2-8..10] | On-tint text tokens; ≥12 px; `htmlFor`; real buttons | fixed, gap left (`9032bbf`): muted text in dimmed rows is under 4.5:1; white on the dark accent is 4.3:1 |
| F11 | P1 | profile | **History pairs content with the wrong change.** Each revision shows its pre-change content beside that change's rationale, and template use is logged as "manual". | `HistoryDropdown.jsx:256`; `useProfile.js:217-241` [fu P1-12] | Show post-change content or a diff | fixed (`259f849`) |
| B8 | P2 | retry | 401, 400, 404 and 413 get `maxRetries+1` attempts with backoff (the probe made 3 calls in 2.7 s). Anthropic 529 isn't treated as a rate limit. | `RateLimitError.js:56,72`; `core.js:211-239` [be P2-1,2] | Typed non-retryable errors; treat 529 as a rate limit | fixed (`5018a50`) |
| B9 | P2 | LLM | `max_tokens` is fixed at 16000 and truncations retry at the same budget. With no timeout, undici's 300 s limit kills billed calls, which retry. Stop never cancels server-side calls. | `callModel.js:91-98,115-119`; `openai.js:60-92` [be P2-4, P1-1] | Per-route budget; timeout; abort on `req` close | partly (`504fb65` names the cut-offs): no per-route budget, timeout or server-side abort |
| B10 | P2 | LLM | Google's billed `thoughtsTokenCount` was uncounted and the key sat in the URL query. Rubric routes defaulted to the preview `gemini-3-flash`. | `google.js:75,119-120`; `quick-filter.js:125` [be P2-5, P3] | Count it; send a header; use `DEFAULT_MODEL_ID` | fixed (`504fb65`) |
| B11 | P2 | briefing | The audit reads a different corpus from synthesis: reports cut at 4,000 chars (typically 5–9 KB), with no justifications or comments. That gives false YES verdicts and a paid re-synthesis. | `check-briefing.js:101-107` [be P2-6] | Render the writer's corpus | fixed (`5018a50`, `b1178b3`) |
| B12 | P2 | cost | A manual "Generate briefing" re-bills every quick summary. Projections assume a filter batch of 10 (the default is 3) and ignore thinking tokens. Fallback tokens are priced at the slot model. | `briefingClient.js:410-421`; `costEstimate.js:28-33`; `analyzerStore.js:227-251` [be P2-8, P3] | Reuse summaries; use the configured batch size | open |
| B13 | P2 | NotebookLM | `[P#]` follows briefing order in briefing.md but score order in the paper files. After a dry run, generation bills the real model on mock data. | `generate-notebooklm.js:116-121,155-158` [be P2-10] | One numbering; mark mock results | open |
| B14 | P2 | persistence | The feedback log grows without limit in localStorage. On a quota failure it only warns, so new stars vanish on reload. Session cold writes are unsequenced (plausible). | `useFeedback.js:22-29,150-167`; `useAnalyzerPersistence.js:620-702` [be P2-12,13; fu P2-2] | Prune or add a cold tier; surface the failure | open |
| B15 | P2 | arXiv | The OAI broad fetch is group-level, so cs.LG+stat.ML pulls all of `cs` (~10×). The oversized entry then evicts the rest of the cache on each run (plausible). | `sets.js:49-54`; `cache.js:59-80` [be P2-14] | Fetch by archive | open |
| B16 | P2 | dates | A run's date comes from three clocks (start, click, save); Analysis Results stars get the previous briefing's date. | `startProcessing.js:98-102`; `App.jsx:831`; `briefingClient.js:515` [be P3; fu P2-6] | Capture one run date | open |
| B17 | P2 | maint. | Four rubric routes (~1,390 lines) repeat one skeleton (a factory saves ~600); two retry ladders; `App.jsx` (1,202 lines) passes 82 props to MainArea. | `core.js:46-244` vs `246-336` [be §5; fu P3-1,2] | `createRubricRoute`; per-view containers | open |
| T6 | P2 | tests | Exported provider keys change the fixture hashes, so 4 tests fail. | `resolveRouteAuth.js:98-101` [ti P2-1] | Delete the keys in `tests/setup.js` | fixed (`0926dfc`) |
| T7 | P2 | fixtures | One fixture is orphaned and 4 don't rehash to their names. There is no record mode, and no test runs the cacheable branch (M10 survives). | `tests/fixtures/llm/bc942c6c…` [ti P2-2] | Delete the orphan; print the hash on a miss | open |
| T8 | P2 | deps | `tiktoken` (24.4 MB trace) knows no GPT-5.x ID. chalk, commander, ora and prompts have 0 importers. | `tokenBudget.js:10` [ti P2-3,6] | Remove them | fixed (`0926dfc`) |
| T9 | P2 | build | `briefings/[id]` traces 197 project files through a dynamic path. `scripts/` and `audits/` aren't excluded. | `briefings/[id].js:10`; `next.config.mjs:12` [ti P2-5] | Static path; extend `EXCLUDED_DIRS` | open |
| T10 | P2 | deps | Playwright 1.56 is a runtime import filed under devDependencies; `@playwright/test` is unused; lucide 0.263.1 blocks React 19; undeclared `prop-types` breaks `npm ci --omit=dev`. | `analyze-pdf.js:31`; `_app.js:2` [ti P2-6; fu P3-5] | Move and bump; declare prop-types | open |
| D3 | P2 | CLAUDE.md | 12 smaller errors, a styling table where only 2 of 4 rows render, and 53.7 KB with duplication and history (listed below the table). | ds A1 10-21, A3; `CLAUDE.md:87-94` | Restructure to ~25 KB | fixed (`a12e721`): 32 KB, not the 25 KB target |
| D4 | P2 | docs | Model docs lag the registry: the tutorial default is "Gemini 3.5 Flash", there are three Anthropic lineups, and the docs say "five LLM slots" (there are 7). After 504fb65, 11 pages name removed IDs. | `first-briefing.md:61`; `api-keys.md:49` [ds C-P2-2..4] | One lineup | fixed (`a12e721`) |
| D5 | P2 | docs | 9 anchors are broken, and VitePress doesn't check anchors. | `pipeline.md:155`; `troubleshooting.md:58,283`; +6 [ds C-P2-5] | Headings without em-dashes; a CI check | fixed, gap left (`a12e721`): no CI anchor check |
| D6 | P2 | docs | `daysBack` is documented as "last 24 hours" (it means N anchored days). Docs also say synthesis sees briefing history, give wrong default categories and list unrecorded provenance fields. | `pipeline.md:55,163`; `arxiv-categories.md:9` [ds C-P2-1,13-15] | Match the code | fixed (`a12e721`, `8c6f34e`) |
| D7 | P2 | docs | Troubleshooting is stale: "Next.js 14 / Node 18.17", a dotenv command that isn't installed, "headed browser", a skip note that doesn't exist, a two-gate checklist and dead error strings. | `troubleshooting.md:80,198,429`; `install.md:7,160` [ds C-P2-6..12] | Quote the current strings | fixed (`a12e721`) |
| D8 | P2 | prompts | The rubrics demand "a single, valid JSON array" while the routes send object schemas. They also carry 58 ALL-CAPS tokens, repeat lists and say "my research interests". suggest-profile calls the filter "Stage 1". | `rubric-filter.md:21,46`; `quick-filter.js:16-37` [ds (e)1,5,7-15; be P1-3] | Let the schema carry the shape | fixed (`a12e721`) |
| D9 | P2 | prompts | check-briefing grades editorial synthesis both MAYBE (:29) and NO (:38), asks for 1 supporting paper where synthesis asks 2, and audits removed sections. rubric-rescoring lacks the breadth calibration. | `check-briefing.md:22-42`; `rubric-rescoring.md:41-42` [ds (e)2-4,6] | One claims standard | fixed (`a12e721`) |
| F12 | P2 | feedback | Rejections aren't stored or fed back, and acceptance isn't measured (POSITIONING §6). Briefing-card reactions arrive as bare titles. | `SuggestDialog.jsx:292-301`; `PaperCard.jsx:38-44` [fu P1-2,5] | Persist outcomes; send the pitch | fixed (`e8ff6bd`) |
| F13 | P2 | feedback | Feedback is a ledger. Saving at a gate leaves no trace, events can't be edited or deleted, every briefing shows the all-time log, and all named profiles share one log. | `useFeedback.js:205-230`; `MainArea.jsx:423-435` [fu P1-6,7, P2-1,3] | A "saved" chip; edit and delete; a log per profile | partly (`e8ff6bd`: edit, delete, Gate 3 echo): no "saved" chip, no log per profile |
| F14 | P2 | review | Score rows print a blank `arxivId` ("· score 6.7"). Filter rows have no abstract or link. | `ScoreReviewSurface.jsx:115`; `FilterResultsList.jsx:181-233` [fu P2-5] | Show the ID, link and abstract | fixed, gap left (`9032bbf`): filter rows still lack the abstract and link |
| B18 | P3 | retry | The correction leg never runs live, so `maxCorrections` only affects dry runs. "N/N batches succeeded" counts failures, and a score of 0 shows as a failure. | `core.js:109-139`; `quickFilter.js:295,322-324` [be P3] | Remove the leg; fix the counts | partly (`5018a50`) |
| B19 | P3 | caching | Rubric prefixes fall below Haiku 4.5's 4096-token cache minimum, yet warmup still serializes each stage. In four routes the static text comes after the variable slots. | `suggest-profile.js:189-190`; `check-briefing.js:187-188` [be P3] | Skip warmup below the minimum; reorder the templates | open |
| B20 | P3 | PDF | The Playwright ID regex breaks Atom URLs and old-style IDs (executed). There's no PDF size cap, and an arXiv 429 pauses the LLM barrier. | `analyze-pdf.js:84-96,354,541-553` [be P3] | Fix the regex; cap the size | open |
| D10 | P3 | docs/voice | UI-label and count slips; gates framed as cost control; 13 em-dashes per 1,000 words (POSITIONING: 3). The UI still says "Training wheels" and "Hallucination check: NO". | `design-principles.md:13-21`; `ReviewConfirmationSection.jsx:33`; `BriefingCard.jsx:77` [ds C-P3, (d); fu P2-11,12] | A §9 pass | partly (`a12e721`, `8c6f34e`): cost tables on 5 pages |
| D11 | P3 | comments | About 100 comment lines have rotted: 12 `ArxivAnalyzer` refs, 19 pointers to gitignored specs, 6 false comments, and `[Phase 1.5.1]` in warnings. | `useAnalyzerPersistence.js:86-102`; `briefingClient.js:299-504` [ds (d)] | One mechanical pass | open |

**Other open P3s, not in the table:**

- [be P3]: plaintext password in the hot tier (`buildHotEntry.js:46`); `{{slot}}` substituted twice; unescaped paper headers; no dedupe with the filter off; one bad briefing blocks migration.
- [ti P3]: 13 fake-timer pairs outside `try/finally`; a real 5 s sleep; lint-staged skips `.mjs`/`.css`/`.yml`.
- [fu P2-4,15,16, P3]: stale login error, no favicon, raw TeX math in titles (accents decoded on branch, 10164d7), red score deltas, dead debate CSS.

**D1 details:**

- L19-20: broken cli commands.
- L63: lists 6 slots sharing one default. There are 7, with defaults 3.5-flash-lite, 3.6-flash and 3.8-flash.
- L61: says all routes accept `apiKey`. Persistence routes use `x-aparture-password`.
- L210, L282: nonexistent `BRIEFINGS_DIR`/`SESSIONS_DIR`.
- L44: a 90-day window. L81: one layout order for two views.
- L43: a `lib/profile` diff module. L198: says `sets.js` uses the category catalog.
- The two-project Vitest rule is missing.

**D3 details:** 12 slices, not 11. 3 `APARTURE_TEST_*` overrides unlisted. The Phase 2 path given 4 ways. A cited "feedback-mechanisms" section that doesn't exist. The thinking rule twice, cacheWarmup three times. Models mapped to 2 doc pages; 14 name them.

**Found and fixed while working, not in the table:**

- A second briefing on the same day showed the first one's editor's-question answers, and answering replaced them (`5cf288e`).
- A reload restored a test run in progress, leaving both test buttons disabled (`27260fe`).
- Stage 3.5 had no model control and stayed on Gemini, so a Claude-only or GPT-only setup failed it (`d1ecda6`).
- `next dev` under an agent appended its own rules to CLAUDE.md (`69f84a1`).
- A paper whose PDF was never analyzed opened a blank full-report panel (`013c25e`).

**Patterns across the findings:**

- **Docs and agent instructions describe behaviour the code doesn't have:** retention, validation, the CLI path and 21 CLAUDE.md claims.
- **Failures degraded silently:** swallowed pool errors, null audits, dropped comments and notes the interface showed as saved.
- **Runs had no identity:** a stopped run hijacked the next one, and dry runs wrote real feedback.
- **Tests are strong in `lib/` but blind at the app shell and the clock:** the suite went red for two months with no scheduled CI to notice.
- **Every failure shared one retry ladder:** bad requests, overloads, truncations and refusals were all retried alike.

### Baseline numbers at `1a35da8`

**Tests** [ti]:

- At `1a35da8`: 1177 tests in 139 files, 9 failing (4 since 2026-08-09, 5 since 2026-08-13).
- 20 full runs with 0 flakes; 2 shuffled orders passed 1177/1177.
- Clock sweeps to 2036 and 6 TZ combinations failed only the same 9.
- Suite time: 52–66 s locally, 53 s in CI.
- Targeted analyzer, llm, arxiv and synthesis suites: 52 files, 422 tests, all passing [be].

**Coverage (v8)** [ti]:

- Lines 78.1%, statements 76.4%, branches 62.5%, functions 73.7% (167 files).
- `components/analyzer` 0%, `components/results` 4.8%, `pages/api` 71.5%, `lib/llm` 92.8%, `lib/arxiv` 94.2%.
- Suggested floor: 75% lines, 60% branches.

**Test quality** [ti]:

- 11 mutations: 6 killed, 5 survived.
- 2,544 expects; `vi.mock` in 4 of 139 files; 0 snapshots.
- 10 committed plus 7 runtime fixtures; 1 orphan; 4 don't rehash.

**Lint and build** [ti]:

- eslint: 0 errors, 0 warnings (16 s). prettier: clean (7.7 s).
- `next build`: 6.9 s, 20 routes, 2 warnings.
- Docs build: 10.3 s, exit 0 [ds].

**Size** [ti]:

- Client JS 708 KB raw, ~196 KB gzipped.
- Traces: synthesize 24.4 MB / 214 files (tiktoken wasm 5.3 MB), analyze-pdf 7.5 MB, `briefings/[id]` 2.5 MB; others 1.1–1.9 MB.

**Advisories** [ti]:

- On 16.2.10: 6 production (1 critical, 4 high, 1 moderate) and 21 total; next carried 17, 3 of them critical.
- After `npx npm@11 audit fix`: 0 production, 10 total. The docs lockfile has 10 (8 high).

**Repo** [ti]: 22 CI runs, the last on 2026-07-29. 422 tracked files.

**CLAUDE.md** [ds]: 53.7 KB, 329 lines; Development Notes 37 KB, padding ~4.7 KB. Target 24–27 KB. 60+ claims checked, 21 wrong. Rewritten on this branch to 32 KB (`a12e721`).

**Docs** [ds]: ~70 UI labels checked. 769 em-dashes in 59k words. 3,935 comment lines against 28,317 code lines.

**Frontend** [fu]:

- 601 inline style blocks; 83 hex and 47 rgba literals; 29 sites at 10–11 px.
- Contrast from 1.84:1 to 3.51:1. 17 overrides after 2 real ones.

**Backend** [be]: the zombie probe made 4 PDF, 2 synthesis and 2 check calls. The seen index is ~1.25 MB.

---

## 7. What changed on this branch

The branch carries about 75 commits. Removing the old CLI accounts for most of the deleted lines. The test suite grew from 1,177 to 1,471 tests, all passing; lint, the build and the docs build pass too. The list is first-parent, newest first; the merges carry the three worker branches.

| Commit    | Change                                                                                                                                                | Addresses               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `c860609` | Remove the old browser CLI (about 5,400 lines), its seven npm scripts and the rules that existed only for it                                          | T3                      |
| `84a1345` | This report lists the doc facts no live page confirmed                                                                                                | report                  |
| `21a7eb4` | The skill's triage note, its Node version, and two comments catch up with the prompt cleanup                                                          | §4                      |
| `9dc9ef9` | This report, kept in `audits/` beside the July audit                                                                                                  | report                  |
| `d1ecda6` | Settings gets a Review Model picker for Stage 3.5, which had no control and stayed on Gemini                                                          | new bug                 |
| `8c6f34e` | The claims-check badge says what it found; Settings stops calling the gates training wheels                                                           | D6, D10                 |
| `013c25e` | Phone layouts: pill rows stack under titles, and the full report opens as a full-screen sheet                                                         | F9                      |
| `27260fe` | A reload no longer restores a test run in progress, which left both test buttons disabled                                                             | new bug                 |
| `4e25269` | App-level dedupe tests, a second CI test pass at UTC+14, read-only CI permissions, timeouts, Dependabot                                               | T4, T5                  |
| `5cf288e` | Two briefings on one day keep their own editor's-question answers                                                                                     | new bug                 |
| `9032bbf` | Status text readable in both themes, 12 px minimum type, labelled fields, sidebar keyboard fix                                                        | F10, F14                |
| `259f849` | Profile history shows what each change did, as a line diff                                                                                            | F11                     |
| `e18e76f` | Docs quote the missing-key message                                                                                                                    | F7                      |
| `a12e721` | Merge: CLAUDE.md rewritten, docs refreshed for the October models, prompts cleaned up                                                                 | D1–D9                   |
| `5581925` | New Briefing opens the run view, and a missing key names its variable                                                                                 | F7                      |
| `b32ce71` | Editor's questions: up to two tap-to-answer questions after each briefing, fed to suggestions                                                         | §2.5                    |
| `69f84a1` | `next dev` no longer appends its agent rules to CLAUDE.md                                                                                             | new bug                 |
| `6d59674` | A paused gate says it is waiting for you and scrolls into view                                                                                        | F8                      |
| `b1178b3` | A failed claims check is retried, then shown; an unaudited briefing never looks audited                                                               | B7, B11                 |
| `e2b9df7` | Stars on test-mode briefings count as test feedback                                                                                                   | F2                      |
| `e8ff6bd` | Merge: feedback fixes (comments reach the writer, no fake dry-run feedback, profiles keep their text, per-event incorporation, remembered rejections) | F1–F6, F12, F13         |
| `5018a50` | Merge: pipeline fixes (Stop stops, local-only server, briefings never deleted, refusal halts, typed retries, stricter validator)                      | B1–B4, B6, B8, B11, B18 |
| `10164d7` | arXiv: clean author names; keep comments and license                                                                                                  | §4                      |
| `36bcbac` | Skill: report every audit round; lessons from the first live run                                                                                      | §4                      |
| `0926dfc` | Next.js security fix, unused dependencies dropped, hermetic tests, weekly CI on Node 22 and 24                                                        | T2, T4, T6, T8          |
| `554d9a6` | Skill briefing: title matching ignores TeX                                                                                                            | §4                      |
| `504fb65` | October 2026 model registry; Anthropic structured output through `output_config`                                                                      | B5, B10                 |
| `dc81885` | Headless runner and the Aparture agent skill (prototype)                                                                                              | §4                      |
| `9810912` | Pin the clock in the dedupe tests                                                                                                                     | T1                      |

---

## 8. Decisions

The owner's answers, on 2026-10-17:

1. **Side-by-side trial of the skill and the app:** not now. The plan question that went with it is moot.
2. **Live verification of the model refresh:** deferred. Settings → Validate setup is free whenever it's wanted, and `node scripts/smoke-llm-routes.mjs` costs a few cents. Six facts in the docs couldn't be checked against a live page: Anthropic prices (taken from a 2026-10-06 table), the format of Google's newer keys, the Gemini 2.5 shutdown date, the 60 RPM free-tier figure, OpenAI's minimum purchase, and Anthropic's starter credit.
3. **Node 22 or later:** accepted.
4. **Grounded podcast:** under discussion, together with proposed profile edits, `learned.md` and figures in the app, and how the skill keeps pace with the app.
5. **Delete `cli/`:** done (`c860609`).
6. **Dependabot:** kept.
7. **Pull request:** opened to merge this branch into `main`.

---

## Appendix: today's run in numbers

| Step                         | Detail                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Categories                   | 19 (cs.AI/CL/CV/IR/LG/MA/NE, stat.AP/CO/ME/ML/OT/TH, astro-ph.CO/EP/GA/HE/IM/SR)                         |
| Harvest                      | OAI-PMH, 638 papers from the anchor day (2026-10-15 v1) plus fill-ups for 8 thin categories; 1,020 total |
| Triage                       | 8 workers × ~128 abstracts; YES 93, MAYBE 186, NO 741                                                    |
| Deep reads                   | 12 papers, all from arXiv HTML (3,411–22,570 words); 9 CC BY, 3 arXiv non-exclusive                      |
| Score change after full text | 11 of 12 lower, 1 higher; largest drop 1.2 (8.1 → 6.9)                                                   |
| Validator                    | Passed on first write: 12 papers, 4 themes, 15 near misses, 12 verbatim quotes, 27 citations             |
| Claim audit                  | Round 1 YES (9 flags), round 2 MAYBE (2 flags); 11 fixed                                                 |
| Page                         | 978 KB; 2 figures embedded, 1 linked; feedback store verified empty and reachable                        |
