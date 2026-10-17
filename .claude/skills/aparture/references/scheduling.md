# Making it daily

A briefing is only useful if it arrives without being asked for. There are two ways to run Aparture on a schedule. Both need the same thing: a state directory that outlives the session.

## In the cloud: a Claude Code routine

A routine fires a fresh cloud session on a cron schedule. Each session starts from a clean container, so the state can't live in the container.

**Where the state lives.** The aparture repository is public, so never commit the reader's profile or feedback to it. Use a private repository instead (for example `<user>/aparture-state`) holding `profile.md`, `config.json`, `learned.md`, `feedback.jsonl`, `seen.json` and `briefings/`. The routine's session clones it, runs with `APARTURE_STATE` pointing at the clone, and pushes at the end of phase 9. Git history then doubles as the profile's changelog. Add `runs/*/candidates.json`, `runs/*/chunks/`, and `runs/*/papers/` to that repository's `.gitignore`, or run `record --prune-run`, so the harvest dumps don't bloat it.

**Creating the routine** (with the reader's go-ahead; it is a standing change to their account):

- Schedule: the reader's local morning, a few minutes off the hour, on the days arXiv announces (Sunday–Thursday evenings ET, so Monday–Friday mornings). For a reader in Toronto: `CRON_TZ=America/Toronto 47 6 * * 1-5`.
- A fresh session on each firing, in an environment whose network policy allows `arxiv.org`, `export.arxiv.org` and `oaipmh.arxiv.org`, with the state repository attached.
- Prompt (standalone, since each firing starts from nothing): "Run the Aparture daily briefing using the aparture skill. State is in the aparture-state repository: clone it, set APARTURE_STATE to the clone, run `npm ci` in the aparture repository, then follow the skill end to end. Publish to the briefingArtifactUrl in config.json, push the state repository, and finish with the five-line report."
- Completion notifications on, so the reader's phone gets the link.

## On the reader's machine: headless Claude Code

For a local-first setup, keep the state directory on disk (e.g. `~/aparture-state`) and schedule Claude Code in print mode with the operating system's scheduler:

```bash
# crontab -e   (weekday mornings at 6:47)
47 6 * * 1-5 cd ~/code/aparture && APARTURE_STATE=~/aparture-state \
  claude -p "Run the Aparture daily briefing using the aparture skill." \
  >> ~/aparture-state/cron.log 2>&1
```

On macOS use a launchd agent instead of cron (cron doesn't run while the machine sleeps; launchd catches up when it wakes). Print mode needs the run's tools allowed without prompting. Configure that in the repository's `.claude/settings.json` (Bash for `node bin/aparture.mjs` and `npm ci`, file writes under the state directory, the Agent tool, and the Artifact tool if publishing).

## Cost and limits

A run on a broad profile (15–20 categories, ~1,000 papers) uses roughly 1.5–2.5M model tokens across workers: about 200K per triage chunk of 128 papers, 60–120K per deep read, and the briefing itself. On a subscription that counts against the plan's usage limits; narrow profiles (3–5 categories, 150–300 papers) cost a fraction of that. If a run is cut off by a limit, it can resume: each phase writes its output to the run directory, so restart from the first missing file.
