# Setting up: the profile and config

A good profile is the difference between a briefing that reads like it knows the reader and one that reads like a press digest. Spend the time here on the first run.

## Writing the profile together

Ask the reader, in one message, for the few things that make a profile work, and offer to draft from their answers:

1. Their field and current projects, in a sentence or two each.
2. Three to six topics or methods they actively follow, as specific as they can make them ("simulation-based inference for galaxy populations", not "machine learning").
3. What makes a paper worth their time: methods over applications? Data releases? Theory?
4. What to skip, with examples ("LLM benchmark papers without a methods contribution").
5. Optionally: authors or groups to always surface, and adjacent areas they'd like occasional coverage of.

Draft `profile.md` in their register (first person, plain prose or short bullets, the way they wrote their answers), show it, and revise until they're satisfied. Four example profiles live in `lib/profile/starterTemplates.js` (focused, breadth, applied ML, and the bracketed fill-in template); show one if the reader wants a model, but never ship one unedited as their profile.

## Choosing categories

Map their topics to arXiv categories (the full list is in `utils/arxivCategories.js`). Each category costs triage time in every run: cs.LG alone posts 300+ papers a day, so a broad profile across 15+ categories means 800–1,200 papers to triage daily. Suggest the smallest set that covers the profile, and mention the cost of adding large categories.

## config.json

```json
{
  "categories": ["astro-ph.GA", "astro-ph.IM", "stat.ME", "stat.ML"],
  "daysBack": 1,
  "readCount": 12,
  "watchlist": ["Hogg", "Foreman-Mackey", "normalizing flow"]
}
```

`readCount` is how many papers get a full deep read: 8–12 suits most readers; more makes the briefing longer, not better. `watchlist` entries match author names and title/abstract text, and promote matches into the reading set.

Create empty `learned.md`, `feedback.jsonl`, and `seen.json` (`{}`). If the reader wants history and backup, make the state directory a git repository (private) so every profile change is a commit.
