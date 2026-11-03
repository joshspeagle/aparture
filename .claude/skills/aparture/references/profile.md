# Setting up: the profile and config

A specific, well-calibrated research profile is what turns the daily briefing into a personalized editorial argument rather than a generic summary list. Invest time on the first run to help the reader make their criteria concrete.

## Writing the profile together

Ask the reader in a single message for the core inputs needed to draft their profile, and offer to compose the initial `profile.md` from their answers:

1. **Field and active projects:** A sentence or two describing their research area and current projects.
2. **Core topics and methods:** Three to six specific topics or methods they track closely (for example, `"simulation-based inference for galaxy populations"` rather than `"machine learning"`).
3. **Selection criteria:** What makes a paper worth reading in full, such as new methodology, empirical benchmarks, data releases, or theoretical guarantees.
4. **Explicit exclusions:** Topics or paper types to skip, with concrete examples (such as `"LLM benchmark papers without a methodological contribution"`).
5. **Watchlist and adjacent areas (optional):** Specific authors, collaborations, or adjacent subfields they want surfaced when relevant.

Draft `profile.md` in the reader's own register (using first-person prose or concise bullets matching their reply), show the draft, and revise it until they approve. The repository includes starter profiles in `lib/profile/starterTemplates.js` (covering focused, breadth, applied ML, and a bracketed fill-in template) that you can show as examples if the reader wants a reference structure, while always tailoring the saved `profile.md` to the reader's specific research.

## Choosing categories

Map the reader's research topics to arXiv subject categories from `utils/arxivCategories.js`. Because each added category increases daily triage volume (`cs.LG` alone receives over 300 submissions on peak days, and a broad profile across 15+ categories can harvest 800–1,200 papers per run), recommend the smallest category set that covers the reader's core and adjacent topics and note the token cost of adding high-volume categories.

## config.json

Write `<state>/config.json` with the reader's chosen settings:

```json
{
  "categories": ["astro-ph.GA", "astro-ph.IM", "stat.ME", "stat.ML"],
  "daysBack": 1,
  "readCount": 12,
  "watchlist": ["Hogg", "Foreman-Mackey", "normalizing flow"]
}
```

The `readCount` field sets how many papers receive a full deep read (8–12 papers fits a ten-minute daily briefing well), and `watchlist` entries match author surnames and title/abstract phrases to promote matching papers into the reading set.

Initialize `learned.md` by running `node bin/aparture.mjs notes --state <state> --init` (which creates empty `Selection`, `Writing`, and `Podcast` sections), create an empty `feedback.jsonl` file, and write `{}` to `seen.json`. If the reader wants versioned history and cloud backup, initialize the state directory as a private Git repository so every profile revision is recorded as a commit.
