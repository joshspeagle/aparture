# Your first briefing

With a working environment behind you, this page walks through producing your first real briefing — on your own profile, with your own categories, end to end. Budget around ten minutes of active attention plus twenty or thirty minutes of pipeline runtime you can spend elsewhere.

The goal is to get through one complete run, not to write the perfect profile or tune every setting. Everything you see here has a deeper page elsewhere in the Guide; the forward links at each step are safe to skip on the first pass.

Before you start, you should have done [Install](/getting-started/install), [API keys](/getting-started/api-keys), and [Verify setup](/getting-started/verify-setup). The page assumes your dev server runs cleanly and your Minimal API Test came back green.

## 1. Open Aparture and look around

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your `ACCESS_PASSWORD`. The app is laid out as a sidebar on the left and a main area that renders whatever the sidebar selects.

The sidebar has three nav links you'll bounce between for this run: **Profile**, **Settings**, and **Pipeline**. It also carries the briefing archive (empty today) and a light/dark theme toggle. Click through the three nav links so you've seen the shape of each view — don't change anything yet.

## 2. Write a starter profile

Click **Profile**. The text box at the top is the single source of what Aparture thinks you care about; every stage of the pipeline reads it, so a few minutes of thought here pays off for the rest of the run.

Don't try to write the perfect profile. Describe your main research area in a couple of sentences, list a few method families or application domains you actively follow, and include some things you're explicitly *not* interested in — the filter model leans hard on negatives. Something like:

```text
I am a researcher working on [YOUR FIELD]. I care most about methodological
papers — new algorithms, models, or theoretical results — rather than
applied-only or incremental benchmark work.

Topics I actively follow:
- [METHOD FAMILY 1]
- [METHOD FAMILY 2]
- [APPLICATION DOMAIN]

I have some interest in adjacent work that uses these methods in novel ways,
but less interest in pure applications of well-established techniques.

I'm not interested in:
- Purely empirical leaderboard papers with no methodological contribution
- Vision-only papers unless they introduce a broadly useful technique
- Engineering or systems work without a research angle
```

Edit the bracketed placeholders to match your actual work, then click **Save changes**. Writing a good profile is its own craft — see [Writing a good profile](/using/writing-a-profile) when you're ready to go deeper.

## 3. Pick a couple of categories and leave the models alone

Click **Settings**. Two things to set, one to leave alone:

- **ArXiv Categories** — pick two or three to start. Reasonable defaults by field: `cs.LG` + `stat.ML` for machine learning, `cs.CL` + `cs.LG` for NLP, `astro-ph.CO` + `astro-ph.IM` for astrophysics, `stat.ME` + `stat.ML` for statistics. You can expand later once you see how many papers come through on a typical day. If none of those match, see [arXiv categories](/concepts/arxiv-categories).
- **Model slots** — match the slots to the provider key(s) you set up. Aparture ships with all-Google defaults (Flash-Lite for filter and quick summary, Flash for scoring, Gemini 3.1 Pro for PDF analysis and briefing), so a Google-only setup can leave them as-is. If you set up only an Anthropic or OpenAI key, switch the slots to that provider's Balanced lineup — the tables on the [Anthropic](/getting-started/api-keys-anthropic#_5-recommended-models), [Google](/getting-started/api-keys-google#_5-recommended-models), and [OpenAI](/getting-started/api-keys-openai#_6-recommended-models) pages list exact picks. Mixing providers across slots works fine too, as long as every slot has a valid key. [Model selection](/concepts/model-selection) covers the trade-offs in depth.
- **Everything else** — skip for now.

Click **Pipeline** to move on.

## 4. Start the run — and expect two pauses

The Progress Timeline shows six stages, all empty, next to a **Start Analysis** button. Before you click it, know that the default run will stop and wait for you twice:

- After the **filter** stage, so you can review what got bucketed into YES / MAYBE / NO and override anything the model got clearly wrong.
- Before **briefing synthesis**, so you can star or dismiss papers from the deep-analysis results. Those signals shape how the briefing gets written.

Both pauses are on by default and can be turned off in Settings → Review & confirmation once you're comfortable. For the first run, clicking through them cold is fine — the point is to see them happen.

Click **Start Analysis**.

## 5. Fetch and filter, then the first pause

The timeline lights up stage-by-stage. The first two run without intervention:

1. **Fetch papers** — the arXiv API query runs against your configured categories (a few seconds to a minute).
2. **Filter papers** — the filter model reads each paper's abstract and triages it as YES, MAYBE, or NO (a few seconds per hundred papers, parallel).

When the filter completes, the pipeline parks at a review gate. The main area shows the three buckets with a one-sentence summary and justification per paper, plus a clickable verdict pill next to each one.

Spend a minute scanning what landed where. If a paper you'd clearly want is in NO, click its pill to cycle it to MAYBE or YES; the reverse if NO papers slipped into YES. Every override gets logged as a `filter-override` feedback event, which does two things at once: reroutes the paper to scoring on this run, and contributes to the signal that the [Suggest Improvements](/using/refining-over-time) flow uses later to refine your profile.

Don't over-engineer this on the first run. Glance, fix anything obviously wrong, click **Continue to scoring →**.

## 6. Scoring and PDF analysis

The pipeline moves through abstract scoring, an optional post-processing consistency pass, and deep PDF analysis of the top-ranked papers. This is the slowest part of the run — PDF download and the analysis LLM call each take real time, and by default they run three-wide in parallel. Realistic wall-clock: five to twenty minutes, depending on how many papers passed the filter and which model you're using for PDFs.

You can walk away here. Progress counters in the timeline and the activity log below it update live, and Aparture's state is persisted to `localStorage`, so navigating to another browser tab won't lose the run.

## 7. Second pause — before the briefing writes

Once PDF analysis finishes, the pipeline parks again with the Analysis Results rendered in the main area. Each paper card has three controls:

- **☆ star** — marks the paper as important. The briefing will give it richer treatment and more prominent placement.
- **⊘ dismiss** — marks it as uninteresting. The briefing will deprioritise it.
- **+ comment** — a short note. Your comments get woven into the paper's write-up in the briefing.

On the first run, skim the results and click **Continue to briefing →** without starring or dismissing anything. Come back and do this with intent on your second run — the feedback loop is where Aparture becomes useful over weeks. See [Giving feedback](/using/giving-feedback) for what each control actually does downstream.

## 8. Read what you got

After briefing synthesis (another fifteen seconds to a minute), the main area fills in. From top to bottom:

- **Analysis Results** — the ranked paper list stays visible, still interactive, still the source of truth for scores and deep summaries.
- **Download Report** — a markdown export of the full run (papers, scores, deep analyses). Useful if you want a standalone file on disk.
- **Briefing** — the editorial reading view. Executive summary at the top, a few thematic groupings, and one card per paper grounding each pitch in your profile.
- **NotebookLM** — a separate add-on for generating a podcast version of the briefing. Skip on the first run; see [Generating a podcast](/add-ons/podcast) when you want it.

A note on the distinction: the briefing and the report are two different outputs of the same run. The **briefing** is what you *read* — rendered in the app, grouped by theme, shaped by your feedback signals and hallucination-checked after synthesis. The **report** is what you *save* — a flat markdown file with the full per-paper detail, no editorial shape. Most daily use revolves around the briefing; the report matters when you want to share or archive a run.

Expect the first briefing to land as rough-but-legible. The filter model hasn't seen any of your feedback yet, your profile is a sketch rather than a honed description, and you didn't give feedback at either gate. That's all fine — the feedback loop sharpens across runs, and that's really what the rest of the Guide is about.

## Next

- [**Reading a briefing**](/using/reading-a-briefing) — decoding what each section of the editorial view actually means, and how the voice behaves.
- [**Giving feedback**](/using/giving-feedback) — what stars, dismisses, comments, and filter overrides actually do to the next run.
- [**Writing a good profile**](/using/writing-a-profile) — rewriting the starter template once you know what you want.
- [**Refining over time**](/using/refining-over-time) — when to use Suggest Improvements to let the tool propose profile edits from accumulated feedback.

If the run failed anywhere — no papers fetched, a stage 429'd, a PDF download blocked — the [troubleshooting page](/reference/troubleshooting) groups symptoms by stage, and [Verify setup](/getting-started/verify-setup) has the two sanity-check buttons if you want to isolate whether it's the pipeline or your configuration.
