# Running as an agent skill

Alongside the browser web application, Aparture ships a repository-backed Agent Skill (`.claude/skills/aparture/SKILL.md`, with `.agents/skills/aparture` linked to the same directory) paired with a headless Node.js runner (`bin/aparture.mjs`). Together they execute the complete daily arXiv workflow inside any `SKILL.md`-compatible coding agent (such as Claude Code, Antigravity, or OpenAI Codex) using your existing agent session or subscription without requiring separate provider API keys in `.env.local`.

In this execution mode, `node bin/aparture.mjs` runs every deterministic and network step in-process (OAI-PMH and Atom harvesting, 90-day seen-paper deduplication, arXiv HTML and PDF full-text extraction, schema and verbatim-quote validation, license-checked figure inlining, PDF figure cropping, HTML rendering, and feedback ingestion) without starting the Next.js server or making LLM calls. The coding agent performs the reading, scoring, synthesis, and hallucination-audit steps using the same rubric and synthesis prompts (`prompts/*.md`) as the web application, with cross-surface parity enforced by `tests/unit/skillParity.test.js`.

## Web application vs. agent skill

Both execution modes share the research profile format, scoring rubrics, arXiv harvesting engine, and editorial synthesis standards, while targeting different daily operating habits:

| Dimension             | Local web application (`npm run dev`)                                                                                          | Agent skill (`SKILL.md` + `bin/aparture.mjs`)                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Execution surface** | Browser interface at `http://localhost:3000`.                                                                                  | Any `SKILL.md`-compatible coding agent (Claude Code, Antigravity, OpenAI Codex) or scheduled CLI job (`claude -p`).                                                           |
| **Model credentials** | Pay-per-token provider API keys (`CLAUDE_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`) stored in `.env.local`.              | The coding agent's active session and worker subagents, requiring no provider API keys in `.env.local`.                                                                       |
| **Human checkpoints** | Interactive mid-run review gates (Gates 1, 2, and 3) where you can adjust filter verdicts and PDF selections before synthesis. | Unattended end-to-end execution that writes disk checkpoints after each phase so interrupted runs resume cleanly.                                                             |
| **Full-text source**  | Manuscript PDFs sent to `/api/analyze-pdf` (with Playwright fallback for reCAPTCHA challenges).                                | Structured arXiv HTML (`$LaTeX$` math preserved, bibliography and appendices stripped), falling back to the manuscript PDF (`pdftotext` and PDF reading) when HTML is absent. |
| **Briefing output**   | Interactive React reading view saved under `reports/briefings/`.                                                               | Self-contained `briefing.html` with base64-inlined figures and verified-quote badges (or an optional `claude.ai` artifact with persistent database feedback controls).        |
| **Persistent state**  | Browser `localStorage` paired with cold JSON files in `reports/`.                                                              | Plain-text and JSON files inside `$APARTURE_STATE` (defaulting to `./aparture-state`), structured for direct editing and Git version control.                                 |

## Prerequisites and setup

Running the Agent Skill requires the Node.js toolchain from [Install](/getting-started/install) and skips the `.env.local` password and API key configuration steps:

1. **Install Node.js 22+ and repository dependencies:** Clone the repository and run `npm ci` (or `npm install`) once from the repository root:

   ```bash
   git clone https://github.com/joshspeagle/aparture.git
   cd aparture
   npm ci
   ```

   Full installation is required because `bin/aparture.mjs` imports `jsdom`'s `DOMParser` to parse OAI-PMH and Atom XML responses and arXiv HTML manuscripts, alongside `pdf.js` and `@napi-rs/canvas` to crop key figures from PDF-only papers.

2. **Install `pdftotext` (optional):** When a selected paper has no arXiv HTML rendering, `enrich` downloads the manuscript PDF and invokes Poppler's `pdftotext` utility (`brew install poppler` on macOS, `sudo apt install poppler-utils` on Ubuntu/Debian) to extract plain text so deterministic quote verification can check verbatim quotes against PDF-only manuscripts.

3. **Set `ARXIV_CONTACT_EMAIL` (optional but encouraged):** Export `ARXIV_CONTACT_EMAIL=you@example.edu` in your shell profile or `.env.local` so `bin/aparture.mjs` sends a contact address in the HTTP `From` header on arXiv requests, which receives more lenient treatment from arXiv's rate-limit heuristics.

4. **Open the repository in your coding agent:**
   - **Claude Code** discovers `.claude/skills/aparture/SKILL.md` automatically when opened in the repository root.
   - **Antigravity and OpenAI Codex** discover `.agents/skills/aparture/SKILL.md`, which links directly to `.claude/skills/aparture/`.
   - **Running from any workspace:** To invoke `/aparture` when working outside the `aparture` checkout, place a thin bridge `SKILL.md` in your user-level skills directory (`~/.claude/skills/aparture/SKILL.md` or `~/.agents/skills/aparture/SKILL.md`) that instructs the agent to read `<path-to-aparture>/.claude/skills/aparture/SKILL.md` and execute `node bin/aparture.mjs` with the working directory set to `<path-to-aparture>`.

5. **Initialize your profile and state directory:** Prompt your agent with `"Set up Aparture"` or `"Run my arXiv briefing"`. When `profile.md` is not yet present in `$APARTURE_STATE`, the skill guides you through drafting `profile.md` (following `.claude/skills/aparture/references/profile.md` or the starter templates in `lib/profile/starterTemplates.js`), mapping your topics to arXiv categories from `utils/arxivCategories.js`, writing `config.json`, and initializing `learned.md` (`node bin/aparture.mjs notes --state ./aparture-state --init`), `feedback.jsonl`, and `seen.json`.

## State directory layout

All persistent state for the Agent Skill lives in `$APARTURE_STATE` (defaulting to `./aparture-state`), isolated from the web application's `reports/` directory so every file remains human-readable and inspectable on disk:

| File or directory       | Purpose                                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile.md`            | Your research profile in plain Markdown prose. Every triage, deep-read, and synthesis step reads this file, and it changes only when you accept a proposed edit or request a direct change.                                                                                                               |
| `config.json`           | JSON configuration specifying `categories` (array of arXiv category codes), `daysBack` (default `1`), `readCount` (number of papers to deep-read, default `12`), an optional `watchlist` of author surnames and key phrases, and an optional `briefingArtifactUrl` recorded after publishing an artifact. |
| `seen.json`             | Map from `arxivId` to first-seen date (`YYYY-MM-DD`). Previously harvested papers are skipped automatically across runs, and entries older than 90 days are pruned during `record`.                                                                                                                       |
| `feedback.jsonl`        | Append-only log of reader feedback events (`star`, `unstar`, `dismiss`, `undismiss`, `already-knew`, `comment`, `answer`, `proposal-decision`, `proposal-applied`, and `proposal-stale`), one JSON object per line.                                                                                       |
| `learned.md`            | Accepted editorial notes organized under `## Selection`, `## Writing`, and `## Podcast` headings (capped at 12 bullets per section, matching the web application's Editorial notes format in `lib/profile/editorialNotes.js`).                                                                            |
| `briefings/<date>.json` | Archived v2 briefing JSON documents written after validation succeeds.                                                                                                                                                                                                                                    |
| `runs/<date>/`          | Per-run working directory holding intermediate checkpoints (`candidates.json`, `chunks/`, `triage/`, `selection.json`, `papers/`, `reports/`, `briefing.json`, `validation.json`, `audit.json`, `briefing.html`, and `record.json`).                                                                      |

Because every persistent file in `$APARTURE_STATE` is plain text or JSON, you can initialize `aparture-state/` as a private Git repository so each run commits newly archived briefings and records accepted profile edits in version history.

## How a skill run works

When you ask the agent for your daily briefing, it creates a dated run directory (`$RUN = <state>/runs/<YYYY-MM-DD>`) and executes nine sequential phases. Because every phase writes its output to `$RUN`, an interrupted session can resume directly from the last completed file on disk:

1. **Collect feedback (`ingest`):** The agent reads new feedback events recorded since the last run (either pulled from a published artifact's backing store via `node bin/aparture.mjs ingest` or stated directly in chat), appends them to `feedback.jsonl`, and applies any accepted profile proposals (`proposal-decision` with `decision: "accept"`) to `profile.md` or `learned.md`.
2. **Harvest (`fetch`):** Running `node bin/aparture.mjs fetch` harvests new announcements across your configured categories via OAI-PMH (falling back to the Atom API if OAI-PMH fails), removes papers already listed in `seen.json`, anchors single-day runs on the most recent `v1` submission date so weekends and holidays resolve cleanly, and splits the remaining candidates into numbered plain-text chunks (`chunks/chunk-01.md`, ...) of roughly 100–150 abstracts each.
3. **Triage in parallel:** The orchestrator launches parallel subagent workers (one per chunk) using a fast model tier. Each worker scores its assigned abstracts against `profile.md` and the `Selection` notes from `learned.md`, applying the `YES / MAYBE / NO` filter rules from `prompts/rubric-filter.md` and the composite score formula `(Research Alignment × 0.5) + (Paper Quality × 0.5)` with profile-aware quality calibration from `prompts/rubric-scoring.md` to write `triage/chunk-NN.json`.
4. **Select the reading set:** The agent pools all `YES` and `MAYBE` papers in descending score order, takes the top `readCount` papers (default `12`), promotes lower-ranked papers that match your `watchlist` or closely resemble recently starred papers, excludes previously dismissed papers, balances subtopics when a single tag dominates more than half of a broad profile's reading set, and records the next 10–15 runner-up papers as `nearMisses` in `selection.json`.
5. **Enrich and deep-read (`enrich`):** Running `node bin/aparture.mjs enrich` fetches each selected paper's full text from arXiv's HTML rendering (preserving `$LaTeX$` math, figure captions, and license metadata while dropping appendices and bibliographies) or downloads the PDF when no HTML version exists, spacing requests 15 seconds apart in compliance with `arxiv.org/robots.txt`. Parallel frontier-model subagents then read each paper in full following `.claude/skills/aparture/references/deep-read.md` and `prompts/rubric-pdf.md`, writing structured technical reports (`reports/<id>.json`) that pair the headline result and up to four key quantitative values with character-for-character verbatim quotes from the paper text.
6. **Write the briefing:** Guided by `.claude/skills/aparture/references/briefing.md`, `prompts/synthesis.md`, and your `Writing` editorial notes, the agent synthesizes `$RUN/briefing.json` (`version: 2`). The briefing opens with a declarative headline, a two-to-three-paragraph editorial lede, and a `readFirst` recommendation, groups the papers into thematic arguments, assigns each paper card a reading tier (`read`, `skim`, or `radar`), lists the `nearMisses` under `"Also worth a look"`, and populates `"Notes from the editor"` with how recent feedback shaped today's selection (`learned`), up to two disambiguation `questions`, and up to three evidence-backed profile `proposals` (triggered when unweighed feedback reaches the 4-point threshold in `lib/profile/autoProposals.js`).
7. **Validate and audit (`validate`):** Running `node bin/aparture.mjs validate` executes deterministic grounding checks (`lib/briefing/v2/validate.js`). Once deterministic validation passes with zero errors, the agent launches an independent audit worker with `prompts/check-briefing.md` to check every per-paper claim against the full reports and extracted paper texts (`audit.json`), revising or removing any flagged claim and archiving prior passes as `audit-round<N>.json` so the rendered colophon reports total claims checked and revised.
8. **Render and publish (`render`):** Running `node bin/aparture.mjs render` builds `$RUN/briefing.html`, fetching or cropping each `read`-tier paper's chosen figure and embedding it as a `data:` URI when the paper's license permits reuse. In local environments, passing `--standalone` produces a complete HTML document that opens directly in any desktop browser; in environments supporting the `claude.ai` Artifact tool, the agent publishes the page to a persistent `briefingArtifactUrl`.
9. **Record (`record`):** Running `node bin/aparture.mjs record` appends all harvested paper IDs to `seen.json`, prunes entries older than 90 days, archives the validated briefing to `<state>/briefings/<YYYY-MM-DD>.json`, optionally removes bulky intermediate harvest files (`--prune-run`), and commits the updated state if `$APARTURE_STATE` is a Git repository.

## Grounding and license checks in v2 briefings

Because the Agent Skill generates a standalone morning newsletter (`lib/briefing/v2/`), `node bin/aparture.mjs validate` and `render` enforce deterministic source-grounding and copyright checks on top of the web application's citation rules:

- **Verbatim quote verification:** Every `read`- and `skim`-tier paper card must pair its `result.text` summary with a `result.quote` copied verbatim from the manuscript (at least 40 characters after Unicode and whitespace normalization via `normalizeForQuote`). `validate` checks that each quote appears inside the paper's extracted full text and rejects the briefing on any mismatch, while `render` marks verified quotes with a check badge on the card.
- **Citation and pool membership:** Every `papers[].id` must belong to `selection.read`, every `nearMisses[].id` must come from the triaged `YES` or `MAYBE` pool, every paper must appear in at least one theme, and card titles must match the harvested arXiv titles after stripping TeX formatting commands (`looseTitle`).
- **Feedback provenance (`becauseRefs`):** When a paper card includes a `because` clause noting that the paper entered the reading set due to earlier reader feedback, `validate` checks that every cited identifier in `becauseRefs` (an arXiv ID, `"comment YYYY-MM-DD"`, or `"answer <qid> YYYY-MM-DD"`) exists in `feedback.jsonl`.
- **Proposal anchor verification:** Every proposed edit to `profile.md` or `learned.md` (`insert`, `replace`, or `delete`) must provide an `anchor` string that appears verbatim in the target file so accepted proposals apply cleanly without fuzzy patching.
- **License-aware figure inlining:** `render` embeds a figure image as a base64 `data:` URI only when the paper carries a Creative Commons (`CC`) or public-domain license (`figureReuseAllowed`). When a paper uses arXiv's default non-exclusive distribution license, `render` respects copyright by rendering a direct link to the figure on `arxiv.org` (including the exact PDF page anchor for PDF-only papers) alongside its caption.

## Headless CLI reference (`bin/aparture.mjs`)

You can also invoke `node bin/aparture.mjs` directly from scripts or custom automation pipelines. Every subcommand writes machine-readable JSON (or HTML for `render`) to `--out` or `stdout` and directs progress messages to `stderr`:

```bash
node bin/aparture.mjs help
```

| Subcommand | Key flags                                                                                                                | What it does                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch`    | `--config <file>` or `--categories a,b,c`, `--days N`, `--semantics <mode>`, `--seen <seen.json>`, `--chunks N`, `--out` | Harvests arXiv in-process via OAI-PMH (with Atom fallback), deduplicates against `seen.json`, writes `candidates.json`, and optionally writes `N` plain-text triage chunks.   |
| `enrich`   | `--in <candidates.json>`, `--ids a,b,c` or `--ids-file <file>`, `--out-dir <dir>`, `--figures N`, `--with-appendix`      | Downloads arXiv HTML full text (or PDF fallback with `pdftotext` extraction and PDF caption indexing) spaced 15 seconds apart, writing `<id>.md` and `<id>.json`.             |
| `validate` | `--run <run-dir>`, `--state <state-dir>`, `--briefing <file>`, `--out <validation.json>`                                 | Validates `briefing.json` against `BriefingV2Schema`, reading-set and near-miss pools, arXiv titles, verbatim full-text quotes, figure IDs, `becauseRefs`, and edit anchors.  |
| `render`   | `--run <run-dir>`, `--state <state-dir>`, `--model <name>`, `--standalone`, `--out <briefing.html>`                      | Renders a validated `briefing.json` into a self-contained HTML page with base64-inlined figures (within a 2.5 MB per-figure and 10 MB total budget) and feedback controls.    |
| `record`   | `--run <run-dir>`, `--state <state-dir>`, `--prune-run`, `--out <record.json>`                                           | Updates `seen.json` (retaining a rolling 90-day window), archives `briefings/<YYYY-MM-DD>.json`, and optionally removes raw harvest dumps, chunks, and PDFs (`--prune-run`).  |
| `ingest`   | `--docs <feedback-docs.json>`, `--state <state-dir>`, `--out <summary.json>`                                             | Converts interactive briefing-page feedback documents into append-only events in `feedback.jsonl`, tracking processed document revisions in `feedback-cursor.json`.           |
| `notes`    | `--state <state-dir>`, `--scope selection\|writing\|podcast`, `--init`                                                   | Prints the formatted editorial-notes block from `learned.md` for the requested prompt scope, or initializes `learned.md` with empty section headings when `--init` is passed. |
| `figure`   | `--pdf <file.pdf>`, `--label "Figure N"`, `--out <file.png>`                                                             | Crops a named figure and extracts its verbatim caption from a local PDF using `lib/figures/cropFigure.js`, printing `{ found, page, label, caption, width, height, out }`.    |

## Scheduling automated daily runs

Because a daily briefing is most useful when it is ready before you open your laptop each morning, you can schedule the Agent Skill to run automatically on weekday mornings corresponding to arXiv's Sunday-through-Thursday Eastern Time announcement cycle.

### Local workstation scheduling (`cron` or `launchd`)

Keep your state directory on local disk (such as `~/aparture-state`) and invoke your CLI agent from the system scheduler. With Claude Code's non-interactive print mode (`claude -p`):

```bash
# crontab -e (runs Monday-Friday at 06:47 local time)
47 6 * * 1-5 cd ~/projects/aparture && APARTURE_STATE=~/aparture-state \
  claude -p "Run the Aparture daily briefing using the aparture skill." \
  >> ~/aparture-state/cron.log 2>&1
```

On macOS laptops that sleep overnight, use a `launchd` plist in `~/Library/LaunchAgents/` because `launchd` executes missed calendar intervals automatically when the machine wakes from sleep. When running non-interactively, pre-authorize Bash execution for `node bin/aparture.mjs`, file reads and writes inside `$APARTURE_STATE`, and subagent spawning in `.claude/settings.json`.

### Optional Claude integrations: persistent Artifacts and cloud routines

When running inside Claude environments that provide the `Artifact` and `ArtifactData` tools (`.claude/skills/aparture/references/publishing.md` and `references/scheduling.md`):

- **Persistent bookmark and interactive feedback (`briefingArtifactUrl`):** Publishing `$RUN/briefing.html` with `capabilities: { "db": {}, "sample": {} }` activates the page's interactive feedback controls (`Star`, `Not for me`, `Already knew it`, `Comment`, editor's question buttons, and proposal `Accept` / `Decline` toggles) alongside an inline `"Ask about it"` box grounded in each paper's deep-read report and the first 1,500 characters of `profile.md`. Republishing subsequent runs to the `briefingArtifactUrl` stored in `config.json` keeps your bookmark constant across days while preserving the `feedback` collection for Phase 1 `ingest`.
- **Cloud routines with a private state repository:** Because a scheduled cloud routine starts in a fresh container on each trigger, store `profile.md`, `config.json`, `learned.md`, `feedback.jsonl`, `seen.json`, and `briefings/` in a separate private Git repository (such as `<username>/aparture-state`). On each scheduled weekday run, the routine clones both `aparture` and `aparture-state`, sets `APARTURE_STATE` to the private state checkout, runs `npm ci`, executes the skill end to end with `record --prune-run`, republishes `briefingArtifactUrl`, and pushes the updated state commit back to the remote repository.

## Next

- [Writing a good profile](/using/writing-a-profile): Structure `profile.md` with positive topics, methodological criteria, and explicit exclusions.
- [Giving feedback](/using/giving-feedback): How stars, dismissals, comments, and question answers accumulate into profile proposals.
- [The pipeline](/concepts/pipeline): Compare the web application's stage architecture and review gates with the headless workflow.
- [Reference: prompts](/reference/prompts): Inspect the shared rubric and synthesis prompts (`prompts/*.md`) read by both execution modes.
