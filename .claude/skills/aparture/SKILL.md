---
name: aparture
description: Run Aparture's daily arXiv briefing. Harvest the day's papers for the reader's categories, triage them against their research profile, deep-read the strongest matches, and write one validated, editorial briefing published as a private artifact page with feedback controls; then fold the reader's feedback back into the profile as proposed edits. Use this whenever someone asks for their arXiv briefing, today's papers, "what's new on the arXiv", to run Aparture, to set up or tune their research profile, to review feedback on a briefing, or when a scheduled routine fires with an Aparture prompt, even if they don't name Aparture.
compatibility: Runs inside the aparture repository (uses node bin/aparture.mjs and prompts/). Needs Node 20+, `npm ci` once, network access to arxiv.org, and the Agent tool for parallel workers. The Artifact tool is optional (falls back to a local HTML file).
---

# Aparture: the daily arXiv briefing

The reader wants to stop skimming the arXiv without worrying about what they're missing. Every choice in a run serves three requirements:

1. **Worth reading.** One editorial briefing that argues across papers, tuned by a profile the reader wrote. Not a ranked list.
2. **Checkable.** Every cited arXiv ID comes from today's harvest, and every specific claim (a number, a method, a result) is traceable to text you actually read. A single fabricated citation ends the reader's trust in the tool, so the validation step is the product, not a formality.
3. **The reader stays in control.** Their profile changes only by edits they accept. You propose; they decide.

A run takes a fresh session roughly 20–40 minutes and mostly runs unattended. Work in the run directory, keep the reader's state directory as the record, and finish with a published briefing plus a short report.

## State: where memory lives

All persistent state is plain files the reader can read and edit, in a **state directory** (`$APARTURE_STATE`, else `./aparture-state`; create it on first run):

| File                    | What it holds                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile.md`            | The reader's research profile, in their words. Every stage reads it. Edit only through accepted proposals.                                                                                              |
| `config.json`           | `categories`, `daysBack` (default 1), `readCount` (papers to deep-read, default 12), `briefingArtifactUrl` (set after first publish), optional `watchlist` of author names and phrases.                 |
| `seen.json`             | arxivId → first-seen date (YYYY-MM-DD). Papers already seen are skipped. Keep 90 days.                                                                                                                  |
| `feedback.jsonl`        | One JSON event per line: `star`, `dismiss`, `comment`, `more-like-this`, `already-knew`, `answer` (to an editor's question), `proposal-decision`. Append-only; never rewrite history.                   |
| `learned.md`            | Accepted preferences that came from feedback rather than the reader's own pen ("prefers papers with released code"; "skip LLM benchmark papers"). Shown to the reader; editable; read with the profile. |
| `briefings/<date>.json` | Each published briefing, in the format in `references/briefing.md`.                                                                                                                                     |

If `profile.md` is missing, stop and help the reader write one (`references/profile.md`). Don't run a briefing on a placeholder profile: it wastes a run and teaches the reader the tool is generic.

## The run

Create a run directory (`$RUN = <state>/runs/<YYYY-MM-DD>`) and go through these phases in order. Each phase writes a file; if a phase fails, fix it and re-run that phase rather than starting over.

### 1. Collect feedback since the last run

Read `references/feedback.md` and follow its intake steps: pull new events from the briefing page's database (when `briefingArtifactUrl` is set and the ArtifactData tool is available) and from anything the reader said in this conversation, append them to `feedback.jsonl`, and apply any proposal the reader accepted (that is the only path by which `profile.md` or `learned.md` changes).

### 2. Harvest

```bash
node bin/aparture.mjs fetch --config <state>/config.json --seen <state>/seen.json \
  --out $RUN/candidates.json --chunks <K>
```

Pick `K` so each chunk holds roughly 100–150 papers (the command logs the count; re-run with a different `--chunks` if needed). The script handles arXiv politeness (OAI-PMH, jittered spacing, retries) and anchors "one day" on the most recent day of submissions, so weekends and holidays work. If it reports zero papers, say so in the report and stop. That is a valid outcome, not an error to work around.

### 3. Triage in parallel

Launch one worker per chunk with the Agent tool, all in a single message so they run concurrently, using `model: "sonnet"` (triage is high-volume judgment; the deep read is where the strongest model pays off). Give each worker the profile, `learned.md`, recent feedback highlights, its chunk file, and the instructions in `references/triage.md`. Each writes `$RUN/triage/<chunk>.json`.

When all return, check coverage: every candidate ID must appear in exactly one triage file. Re-run a worker whose file is missing or incomplete.

### 4. Select the reading set

Rank YES and MAYBE papers by score. Take the top `readCount`, then adjust: add any paper matching the watchlist or strongly resembling recent stars; keep the set from collapsing onto one subtopic when the profile is broad; never add a paper the reader dismissed before. Write `$RUN/selection.json` with each chosen ID and a one-line reason, plus the next 10–15 as `nearMisses` (they appear in the briefing as "also worth a look"). Read `references/triage.md` § Selection for the tie-breaking rules.

### 5. Enrich and deep-read

```bash
node bin/aparture.mjs enrich --in $RUN/candidates.json --ids <comma-separated selection> \
  --out-dir $RUN/papers --out $RUN/enrich.json
```

This writes `$RUN/papers/<id>.md` (the paper's full text from arXiv's HTML rendering, math as LaTeX, with figure captions). Papers without an HTML version get `<id>.pdf` instead, plus extracted text when `pdftotext` is installed. Requests to arxiv.org are spaced 15 seconds apart, as its robots.txt asks, so twelve papers take about three minutes; run it in the background and start nothing else that touches arXiv meanwhile.

Then launch one deep-read worker per paper (or per pair, for more than ~12 papers), in a single message, with the session's default model. Each follows `references/deep-read.md` and writes `$RUN/reports/<id>.json`: a technical report, the key result with the exact sentence it comes from, a key-figure choice, and a skeptical note. The verbatim quotes are what make the briefing checkable later, so workers must copy them character-for-character from the paper text.

### 6. Write the briefing

Read `references/briefing.md` (format, editorial voice, what each section is for) and write `$RUN/briefing.json` yourself from the reports, the selection, the near misses, and the reader's recent feedback. This is the part the reader came for: an editor's argument about what today's papers mean for their work, not a summary of each.

### 7. Validate

```bash
node bin/aparture.mjs validate --run $RUN --state <state>
```

This checks the schema, that every cited arXiv ID is in the reading set or near misses, and that every quoted string appears verbatim in that paper's text. Fix every error it reports and run it again until it passes; do not publish a briefing that fails it.

Then launch one checker worker (`references/briefing.md` § Audit) that reads the briefing against the reports and flags any per-paper claim the sources don't support. Revise or delete flagged claims. Editorial synthesis across papers is allowed; invented specifics are not.

### 8. Render and publish

```bash
node bin/aparture.mjs render --run $RUN --state <state> --model "<model name>"
```

Publish `$RUN/briefing.html` with the Artifact tool as described in `references/publishing.md` (it declares the `db` capability so the reader's stars, comments and answers come back to the next run). Reuse `briefingArtifactUrl` from `config.json` so the reader keeps one bookmark; record it there after the first publish. Without the Artifact tool, leave the HTML file and say where it is.

### 9. Record

```bash
node bin/aparture.mjs record --state <state> --run $RUN
```

This adds every harvested ID to `seen.json`, archives the briefing to `briefings/`, and prunes entries older than 90 days. If the state directory is a git repository, commit with a message naming the date and paper counts, and push if a remote is configured.

Finish with a report of five lines or fewer: papers harvested / triaged YES·MAYBE / deep-read, the briefing link, validation results, and anything that needs the reader (a proposal awaiting a decision, a phase that degraded).

## Feedback and the profile

The profile works like memory. It should get sharper every week, in a form the reader can read. `references/feedback.md` has the full procedure; the principles:

- **Propose, never apply silently.** Feedback produces at most two or three proposed edits per run, each with the evidence that motivated it (the papers starred or dismissed, the comment quoted). They appear in the briefing's "Notes from the editor" with accept/decline buttons. Only accepted proposals touch `profile.md` or `learned.md`.
- **Ask, don't guess.** When feedback is ambiguous (a dismissal of a paper squarely inside the profile), ask one short question in the briefing instead of editing. Answers are feedback too.
- **Show the effect.** When a paper is in today's briefing because of something the reader taught you, say so in one clause ("you starred two papers on this last week").

## Other requests

- **"Set up Aparture" / first run:** `references/profile.md` (writing the profile together, choosing categories, `config.json`), then `references/scheduling.md` to make it daily.
- **"Why did you include / skip X?":** answer from `$RUN/triage/*.json` and `selection.json`. Every exclusion has a recorded reason; quote it.
- **"Change my profile":** edit `profile.md` directly when the reader dictates the change; show the diff.
