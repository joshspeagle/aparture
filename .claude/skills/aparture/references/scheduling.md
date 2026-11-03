# Making it daily

A daily briefing works best when it is waiting for the reader each morning. You can schedule Aparture either in the cloud via a Claude Code routine or locally via the operating system's task scheduler, provided the state directory persists across sessions.

## In the cloud: a Claude Code routine

A cloud routine launches a fresh container session on a cron schedule, so persistent state must be stored in an external Git repository.

**Where the state lives:** Because the `aparture` code repository is public, store the reader's personal `profile.md`, `config.json`, `learned.md`, `feedback.jsonl`, `seen.json`, and `briefings/` files in a separate private Git repository (for example, `<user>/aparture-state`). On each scheduled run, the session clones that state repository, sets `APARTURE_STATE` to the clone path, and pushes the updated state at the end of Phase 9 so Git history records every briefing and profile edit. Add `runs/*/candidates.json`, `runs/*/chunks/`, and `runs/*/papers/` to the state repository's `.gitignore` (or pass `record --prune-run`) to keep raw harvest artifacts out of Git history.

**Creating the routine** (after confirming with the reader, since a routine runs automatically on their account):

- **Schedule:** Set the cron expression for the reader's local weekday morning (a few minutes off the top of the hour) on the days corresponding to arXiv's Sunday–Thursday evening Eastern Time announcement cycle (Monday–Friday mornings in North America and Europe; for example, `CRON_TZ=America/Toronto 47 6 * * 1-5`).
- **Environment:** Configure a fresh session per trigger with network access to `arxiv.org`, `export.arxiv.org`, and `oaipmh.arxiv.org`, and attach both `aparture` and the private state repository.
- **Prompt:** Supply a self-contained prompt because each run starts in a clean session: `"Run the Aparture daily briefing using the aparture skill. State is in the aparture-state repository: clone it, set APARTURE_STATE to the clone, run npm ci in the aparture repository, then follow the skill end to end. Publish to the briefingArtifactUrl in config.json, push the state repository, and finish with the five-line report."`
- **Notifications:** Enable completion notifications so the reader receives the briefing link on their phone or email when the run finishes.

## On the reader's machine: headless Claude Code

For a local schedule, store the state directory on disk (such as `~/aparture-state`) and invoke Claude Code in print mode (`claude -p`) from the system scheduler:

```bash
# crontab -e   (weekday mornings at 6:47)
47 6 * * 1-5 cd ~/code/aparture && APARTURE_STATE=~/aparture-state \
  claude -p "Run the Aparture daily briefing using the aparture skill." \
  >> ~/aparture-state/cron.log 2>&1
```

On macOS, prefer a `launchd` agent over `cron` because `launchd` runs missed jobs automatically when the machine wakes from sleep. Because print mode runs non-interactively, pre-authorize the required tools in `.claude/settings.json` (Bash execution for `node bin/aparture.mjs` and `npm ci`, file writes inside the state directory, the Agent tool, and the Artifact tool when publishing).

## Cost and limits

A daily run on a broad multi-archive profile (15–20 categories, ~1,000 harvested papers) consumes roughly 1.5–2.5M tokens across all workers (approximately 200K tokens per 128-paper triage chunk, 60–120K tokens per full-paper deep read, and the synthesis and audit calls), whereas a focused profile (3–5 categories, 150–300 papers) uses a small fraction of that budget. If a run stops mid-way due to a usage limit, re-running the skill resumes from the first unfinished phase because every completed phase writes its output file to `$RUN`.
