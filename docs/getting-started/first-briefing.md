# Your first briefing

This is the quickstart. It takes about 10 minutes of active time, plus another 20-30 minutes of pipeline runtime in the background. By the end, you'll have a full briefing on screen: arXiv papers fetched, scored, read, and synthesised based on your profile.

The goal here is to get through one complete run end-to-end. Things worth knowing in passing are flagged inline, but they're not explained in depth — if you want to go deeper on any step, follow the forward-links. There's a whole [Guide](/using/reading-a-briefing) section waiting on the other side.

Before you start, you should have already:

- [Installed Aparture](/getting-started/install)
- [Added at least one API key](/getting-started/api-keys) to `.env.local`
- Optionally run [Verify setup](/getting-started/verify-setup) to confirm your keys work

If any of those are still open, finish them first.

## 1. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your `ACCESS_PASSWORD` from `.env.local`. The main Aparture interface should load.

## 2. Take a 60-second tour

Before doing anything, look around. The interface has four regions:

- **Left sidebar.** At the top, a "+ New Briefing" button and a list of past briefings (empty right now). At the bottom, navigation links for **Profile**, **Settings**, and **Pipeline**, plus a light/dark theme toggle.
- **Your Profile panel.** Click **Profile** in the sidebar. This is the primary input to the tool — every pipeline stage reads it. You'll fill it in next.
- **Settings.** Click **Settings** in the sidebar. This is where you pick arXiv categories, choose models, and tune thresholds.
- **Pipeline.** Click **Pipeline** in the sidebar. This is where runs happen — progress timeline, Start/Stop controls, and where briefings render once they're done.

Your first-run path bounces between these three views: Profile → Settings → Pipeline.

## 3. Paste a starter profile

Click **Profile** in the sidebar. You'll see a text area labelled "Your Profile".

Don't try to write the perfect profile on your first run. Paste this starter template — it's deliberately generic and works across fields. You can refine it later (see [Writing a good profile →](/using/writing-a-profile)).

```text
I am a researcher working on [YOUR FIELD, e.g. machine learning for scientific
applications]. I care most about methodological papers — new algorithms, models,
or theoretical results — rather than applied-only or incremental benchmark work.

Topics I actively follow:
- [METHOD FAMILY 1, e.g. Bayesian inference, transformers, diffusion models]
- [METHOD FAMILY 2]
- [APPLICATION DOMAIN, e.g. astrophysics, genomics, NLP]

I have some interest in adjacent work that uses these methods in novel ways, but
less interest in pure applications of well-established techniques.

I'm not interested in:
- Purely empirical leaderboard papers with no methodological contribution
- Vision-only papers unless they introduce a broadly useful technique
- Papers that are strictly engineering / systems without a research angle
```

Edit the bracketed placeholders to describe your actual work, then click **Save changes**. Don't worry about getting this perfect — you'll refine it after your first briefing based on what you see.

## 4. Pick 2-3 arXiv categories

Click **Settings** in the sidebar and find the **ArXiv Categories** section near the top.

Pick 2-3 categories to start. A few sensible defaults:

- **Machine learning:** `cs.LG`, `stat.ML`
- **NLP:** `cs.CL`, `cs.LG`
- **Astrophysics:** `astro-ph.CO`, `astro-ph.IM`
- **Statistics:** `stat.ME`, `stat.ML`

Keep it small for now. You can add more categories later once you see how many papers come through per day. If you're not sure which ones to pick, see [arXiv categories →](/concepts/arxiv-categories).

## 5. Accept the default models

Scroll down in Settings to the **Model** dropdowns (Filter Model, Scoring Model, PDF Analysis Model, Briefing Model).

Leave these at their defaults. As of April 2026, the defaults are Google Gemini models — a balanced mix of Flash-Lite for filtering, Flash for scoring, and Gemini 3.1 Pro for deep analysis and briefing synthesis. These are fast, capable, and the cheapest Day-1 option, especially if you're on Google's free tier.

You can mix providers and swap models later. See [Tuning the pipeline →](/using/tuning-the-pipeline) and [Model selection →](/concepts/model-selection).

## 6. Heads-up: the run will pause twice

::: tip Two review gates
By default, Aparture pauses twice during a run — once after the quick filter, once before briefing synthesis. These are review gates: they let you catch bad filtering or add feedback before expensive stages.

For your first run, just click **Continue** at each gate. The sections below explain what you're looking at inline.

More at [Review gates →](/using/review-gates).
:::

## 7. Click Start Analysis

Click **Pipeline** in the sidebar. You'll see the Progress Timeline (six stages, all currently empty) and a big **Start Analysis** button. Click it.

The timeline will light up as stages run:

1. **Fetch papers** — queries arXiv for your categories (10-60s).
2. **Filter papers** — a fast YES/NO/MAYBE triage using a cheap model (5-30s per 100 papers).
3. **Score abstracts** — a more careful 0-10 relevance score on the survivors.
4. **Post-process scores** — optional consistency pass.
5. **Analyze PDFs** — full PDF read of the top N papers (the expensive stage).
6. **Generate briefing** — cross-paper synthesis into a structured reading view.

## 8. Gate 1 — after the quick filter

The timeline will pause at "Filter complete — review results before scoring."

Below the timeline you'll see filter results grouped into three buckets: **YES**, **MAYBE**, **NO**. Each paper has a short one-sentence summary from the filter model, plus its justification.

Every paper has three verdict pills (YES / MAYBE / NO). Click a pill to override the model's verdict — for example, if a paper is in YES but you know it's irrelevant, click NO to move it. Each override is recorded as feedback and helps the next Suggest-Improvements call refine your profile.

For your first run, just click `Continue to scoring →` without overriding anything. You can spend time on the pills later, once you've seen a briefing.

More at [Review gates →](/using/review-gates) and [Giving feedback →](/using/giving-feedback).

## 9. Scoring and PDF analysis run

After you continue, the pipeline moves through abstract scoring, post-processing (if enabled), and PDF analysis. This is the slowest part — downloading PDFs and running deep analysis takes 30-120 seconds for the top 10 papers. Feel free to check a browser tab.

You'll see live progress counters in the timeline and an activity log below it.

## 10. Gate 2 — before briefing synthesis

Once PDF analysis finishes, the pipeline pauses again at "Analysis complete — review results and add stars/dismissals before generating your briefing."

This is your chance to tell the synthesis model which papers you actually care about. In the Analysis Results list below, each paper card has:

- **☆ star** — mark as important. The briefing will give this paper richer treatment.
- **⊘ dismiss** — mark as not interesting. The briefing will deprioritize it.
- **+ comment** — jot a thought. Your comments get integrated into the paper's "why it matters" prose.

For your first run, just click `Continue to briefing →` without starring or dismissing anything. Get through one run end-to-end first, then come back and do this with intent next time.

More at [Giving feedback →](/using/giving-feedback).

## 11. The briefing renders

After synthesis (another 15-60 seconds), the main area fills in with your briefing. From top to bottom:

- **Analysis Results** — the ranked list of papers with scores, justifications, and deep-analysis summaries. Still there, still interactive.
- **Download Report** — a card with a green button to export a full markdown report of the run.
- **Briefing** — the editorial reading view, with an executive summary, 2-5 themes, and one card per paper.
- **NotebookLM** — a podcast-bundle generator card (more on this in a moment).

Take a moment to read the briefing. The executive summary at the top is a 200-400 word editorial lead framing the day's papers as a story. Below that, themes group related papers, and each paper card has a one-line pitch plus a "why it matters" paragraph grounded in your profile.

::: info The first briefing is usually just okay
Don't be surprised if the first briefing isn't great — it's working from a generic profile with no feedback history. The loop gets sharper over subsequent runs as you star, dismiss, and refine.
:::

More at [Reading a briefing →](/using/reading-a-briefing).

## 12. Optional: the NotebookLM card

Below the briefing you'll see a **NotebookLM** card. This lets you download a bundle (ZIP of markdown files plus a focus-prompt) that you can paste into [notebooklm.google.com](https://notebooklm.google.com) to generate a commute-length podcast version of the briefing.

Skip it for now. It's optional, it's manual (NotebookLM doesn't have an API), and it's a whole separate workflow.

More at [Generating a podcast →](/add-ons/podcast).

## Next steps

You've done one run. Now:

- Open **Reading a briefing** to understand what you're looking at. → [Reading a briefing](/using/reading-a-briefing)
- Come back tomorrow, run another briefing, and start giving it feedback. → [Giving feedback](/using/giving-feedback)
- After a week or so, try Suggest Improvements to let the tool refine your profile based on accumulated stars and dismisses. → [Refining over time](/using/refining-over-time)

If something broke along the way, see [Verify setup](/getting-started/verify-setup) for the two sanity-check buttons, or check the troubleshooting section of [Tuning the pipeline](/using/tuning-the-pipeline).
