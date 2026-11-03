---
name: aparture
description: Run Aparture's daily arXiv briefing. Harvest the day's papers for the reader's categories, triage them against their research profile, deep-read the strongest matches, and write one validated, editorial briefing published as a private artifact page with feedback controls; then fold the reader's feedback back into the profile as proposed edits. Use this whenever someone asks for their arXiv briefing, today's papers, "what's new on the arXiv", to run Aparture, to set up or tune their research profile, to review feedback on a briefing, or when a scheduled routine fires with an Aparture prompt, even if they don't name Aparture.
compatibility: Runs inside the aparture repository (uses node bin/aparture.mjs and prompts/). Needs Node 22+, `npm ci` once, network access to arxiv.org, and the Agent tool for parallel workers. The Artifact tool is optional (falls back to a local HTML file).
---

# Aparture: the daily arXiv briefing

Aparture exists so a reader can stop skimming the arXiv without worrying about missing relevant papers. Every run is structured around editorial synthesis, source verification, and reader control over profile updates:

1. **Editorial synthesis:** Each run produces a single thematic briefing that connects the day's papers and evaluates them against the profile the reader wrote.
2. **Source verification:** Every cited arXiv ID comes from the day's harvest, and every specific claim (a number, a method, or a result) traces directly to text you read. Because a single fabricated citation breaks the reader's trust in automated synthesis, the validation pass sits in the critical path before publication.
3. **Reader control:** The research profile changes only when the reader accepts a proposed edit or dictates a change directly.

A full run takes roughly 20–40 minutes in a fresh session and executes largely unattended. Work inside the run directory, treat the reader's state directory as the system of record, and conclude with a published briefing and a concise run summary.

## State: where memory lives

All persistent state lives in plain-text and JSON files inside a **state directory** (`$APARTURE_STATE`, defaulting to `./aparture-state` and created on the first run) so the reader can inspect and edit every file directly:

| File                    | What it holds                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile.md`            | The reader's research profile in their own words. Every stage reads this file, and it is modified only through accepted proposals or direct reader requests.                                                                                                                                                                                         |
| `config.json`           | `categories`, `daysBack` (default `1`), `readCount` (number of papers to deep-read, default `12`), `briefingArtifactUrl` (populated after the first publish), and an optional `watchlist` of author names and key phrases.                                                                                                                           |
| `seen.json`             | A map from `arxivId` to first-seen date (`YYYY-MM-DD`). Previously seen papers are skipped automatically, and entries are retained for 90 days.                                                                                                                                                                                                      |
| `feedback.jsonl`        | One JSON event per line (`star`, `dismiss`, `comment`, `more-like-this`, `already-knew`, `answer` for an editor's question, and `proposal-decision`). This log is append-only.                                                                                                                                                                       |
| `learned.md`            | Editorial notes recording accepted preferences derived from reader feedback under `## Selection`, `## Writing`, and `## Podcast` headings, with one bullet per note (for example, `"Prefers papers with released code"`). This file shares the format and per-section limits of the web app's Editorial notes tab (`lib/profile/editorialNotes.js`). |
| `briefings/<date>.json` | Each published briefing stored in the schema defined in `references/briefing.md`.                                                                                                                                                                                                                                                                    |

If `profile.md` is missing, stop and help the reader draft one following `references/profile.md` because running on a generic placeholder profile produces an uninformative briefing.

## The run

Create a run directory (`$RUN = <state>/runs/<YYYY-MM-DD>`) and execute the following phases sequentially. Because each phase writes its output to disk, you can fix and re-run any failed phase directly from its checkpoint.

### 1. Collect feedback since the last run

Read `references/feedback.md` and run its intake sequence: fetch new events from the briefing page's database (when `briefingArtifactUrl` is set and the ArtifactData tool is available) alongside any preferences stated in the current conversation, append those events to `feedback.jsonl`, and apply any proposals the reader accepted.

### 2. Harvest

```bash
node bin/aparture.mjs fetch --config <state>/config.json --seen <state>/seen.json \
  --out $RUN/candidates.json --chunks <K>
```

Choose `K` so that each chunk holds roughly 100–150 papers (the command logs the total count, and you can re-run it with an adjusted `--chunks` value if needed). The script enforces arXiv request spacing (OAI-PMH harvesting, jittered delays, and retries) and anchors a single-day window on the most recent submission day so that weekends and holidays resolve cleanly. If the harvest returns zero new papers, report that outcome and stop.

### 3. Triage in parallel

Launch one worker per chunk concurrently in a single message using the Agent tool with `model: "sonnet"`, which provides fast high-volume abstract evaluation before full-paper reading. Pass each worker the research profile, the selection notes (`node bin/aparture.mjs notes --state <state> --scope selection`), recent feedback highlights, its assigned chunk file, and the rubric instructions in `references/triage.md`. Each worker writes `$RUN/triage/<chunk>.json`.

Once all workers return, verify that every candidate arXiv ID appears in exactly one triage output file, and re-run any worker whose output is missing or incomplete.

### 4. Select the reading set

Rank all `YES` and `MAYBE` papers by score and take the top `readCount` papers, then apply the selection adjustments in `references/triage.md` (§ Selection): include papers that match the `watchlist` or closely resemble recent starred papers, diversify across subtopics when the profile is broad, and exclude any paper the reader previously dismissed. Write `$RUN/selection.json` with each selected ID and a one-line selection rationale, followed by the next 10–15 papers as `nearMisses` (which appear in the briefing under `"Also worth a look"`).

### 5. Enrich and deep-read

```bash
node bin/aparture.mjs enrich --in $RUN/candidates.json --ids <comma-separated selection> \
  --out-dir $RUN/papers --out $RUN/enrich.json
```

This command writes `$RUN/papers/<id>.md` containing the paper's full text from arXiv's HTML rendering, with math formatted as LaTeX and figure captions preserved. Papers without an HTML rendering are downloaded as `<id>.pdf` instead, accompanied by extracted text when `pdftotext` is installed. Because `arxiv.org` `robots.txt` specifies a 15-second crawl delay between page and file requests, enriching 12 papers takes roughly three minutes; run this step in the background without issuing concurrent requests to arXiv.

Next, launch one deep-read worker per paper (or per pair of papers when selecting more than ~12 papers) in a single message using the session's default frontier model. Each worker follows `references/deep-read.md` and writes `$RUN/reports/<id>.json` containing a technical summary, the key result paired with its exact source sentence, a key-figure selection, and a methodological caveat. Workers must copy verbatim quotes character-for-character from the paper text so deterministic quote validation succeeds in Phase 7.

### 6. Write the briefing

Read `references/briefing.md` for the schema, editorial voice, and section structure, then write `$RUN/briefing.json` directly from the deep-read reports, the selection list, the near misses, and the reader's recent feedback. Frame the briefing as a cohesive editorial argument explaining what the day's papers mean for the reader's research agenda.

### 7. Validate

```bash
node bin/aparture.mjs validate --run $RUN --state <state>
```

This validator verifies the JSON schema, checks that every cited arXiv ID belongs to the selected reading set or near misses, and confirms that every quoted string appears verbatim in that paper's full text. Fix any reported errors and re-run validation until it passes cleanly before proceeding.

After deterministic validation passes, launch one audit worker (`references/briefing.md` § Audit) to compare the briefing against the deep-read reports and flag any unsupported per-paper claims. Revise or remove every flagged claim while preserving valid cross-paper synthesis.

### 8. Render and publish

```bash
node bin/aparture.mjs render --run $RUN --state <state> --model "<model name>"
```

Publish `$RUN/briefing.html` with the Artifact tool following `references/publishing.md` (declaring the `db` capability so the reader's stars, comments, and question replies persist for the next run). Reuse `briefingArtifactUrl` from `config.json` so the reader's bookmark stays constant, and record the URL in `config.json` after the first publish. If the Artifact tool is unavailable in the current environment, keep the local HTML file and report its path.

### 9. Record

```bash
node bin/aparture.mjs record --state <state> --run $RUN
```

This command appends every harvested arXiv ID to `seen.json`, archives the briefing under `briefings/`, and prunes `seen.json` entries older than 90 days. If the state directory is a Git repository, commit the updated state with a message recording the date and paper counts, and push to the configured remote.

Conclude with a summary of five lines or fewer reporting the counts of papers harvested, triaged (`YES` and `MAYBE`), and deep-read, the published briefing link or file path, the validation and audit outcome, and any items awaiting reader action (such as pending profile proposals or degraded stages).

## Feedback and the profile

The research profile functions as inspectable long-term memory that sharpens over time as the reader reviews briefings. Full rules are in `references/feedback.md`, governed by the following principles:

- **Propose edits explicitly:** Accumulated feedback produces at most two or three proposed edits per run, each backed by the specific starred or dismissed papers and quoted comments that motivated it. Proposals render in the briefing's `"Notes from the editor"` section with accept and decline controls, and only accepted proposals modify `profile.md` or `learned.md`.
- **Ask when signal is ambiguous:** When a feedback event could support multiple interpretations (such as dismissing a paper that matches a core profile topic), include a short multiple-choice question in the briefing so the reader can clarify the boundary.
- **Surface the causal link:** When a paper is included in the current briefing because of a preference the reader taught the system in an earlier run, note that connection in a brief clause (for example, `"because you starred two papers on this method last week"`).

## Other requests

- **"Set up Aparture" or first run:** Follow `references/profile.md` to draft the profile, select arXiv categories, and write `config.json`, then consult `references/scheduling.md` if the reader wants automated daily runs.
- **"Why did you include / skip X?":** Look up the paper in `$RUN/triage/*.json` and `selection.json` and quote the recorded verdict rationale.
- **"Change my profile":** Edit `profile.md` directly when the reader dictates an explicit change, and show the resulting diff.
