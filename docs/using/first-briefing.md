# Your first briefing

Producing a first end-to-end briefing on your own research profile and arXiv categories requires roughly ten minutes of active interaction across a pipeline run that otherwise executes in the background. Completing one full pass establishes a working baseline before you refine the profile text or adjust stage parameters, and the deeper reference links at each step can wait until your second run.

Before starting, complete [Install](/getting-started/install), [API keys](/getting-started/api-keys), and [Verify setup](/getting-started/verify-setup) so that your development server runs cleanly and the Minimal API Test passes.

## 1. Open Aparture and look around

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your `ACCESS_PASSWORD`. The application interface pairs a navigation sidebar on the left with a main workspace that renders the active view. On a narrow window or mobile screen, the sidebar collapses into a drawer that opens via the ☰ button in the top bar.

The sidebar holds the list of archived briefings (initially empty), a light and dark theme toggle, and the <span class="ui-action">Profile</span>, <span class="ui-action">Settings</span>, and <span class="ui-action">Pipeline</span> navigation links used throughout a run. Clicking through each navigation link now previews the layout before you enter any configuration changes.

![The welcome view after first login displays a "Welcome to Aparture" heading, a short description, and a "To get started" card with numbered setup steps and a first-run checklist.](/screenshots/welcome-checklist.png)

_The welcome view greets a fresh installation with an interactive first-run checklist whose items mark off automatically as you complete each setup step._

## 2. Pick a starter template, or write your own

Open the <span class="ui-action">Profile</span> view. On a fresh installation, a starter template picker appears at the top with four example profiles (`Focused: Bayesian cosmology`, `Breadth: ML + statistics + astrophysics`, `Applied machine learning`, and `Fill-in template`). Selecting any card populates the profile text and assigns a matching arXiv category list in one click. The focused single-subfield profile provides the clearest starting model for most researchers, though you can also skip the picker and write directly in the editor. The starter templates serve as initial working examples so you can observe one complete run before substituting your own research description.

![The Profile view on a fresh install shows the four-card starter template picker at the top and the fill-in profile template in the text box below.](/screenshots/template-picker.png)

_The starter template picker sits above the profile editor on a fresh installation and disappears once you save an edit or dismiss the card._

Below the picker, the profile editor holds the prose description that guides your runs. Because every stage of the pipeline reads this document to judge relevance, spending a few minutes clarifying your core topics improves every downstream stage.

An initial profile only needs two or three sentences describing your primary research area, a short list of method families or application domains you actively follow, and an explicit list of topics to exclude because the filter model relies heavily on negative scope boundaries. The shipped fill-in template uses this structure:

```text
I am a researcher working on [YOUR FIELD]. I care most about methodological
papers (new algorithms, models, or theoretical results) over
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

Replace the bracketed placeholders with your actual research areas and click <span class="ui-action">Save changes</span>. When you are ready to refine the prose or maintain multiple named profiles, see [Writing a good profile](/using/writing-a-profile).

## 3. Check your categories and leave the models alone

Open the <span class="ui-action">Settings</span> view to verify your arXiv category selection and model slot assignments while leaving the remaining advanced parameters at their defaults:

- **ArXiv Categories**: If you selected a starter template, its categories are already populated. Otherwise, choose two or three subcategories to start: `cs.LG` + `stat.ML` for machine learning, `cs.CL` + `cs.LG` for natural language processing, `astro-ph.CO` + `astro-ph.IM` for astrophysics, or `stat.ME` + `stat.ML` for statistics. You can expand the list once you see how many papers arrive on a typical day. For other domains, see [arXiv categories](/concepts/arxiv-categories).
- **Model slots**: Match the stage model slots to the provider API keys you configured. Aparture ships with all-Google defaults (Gemini Flash-Lite for the quick filter and quick summaries, and Gemini Flash for abstract scoring, PDF analysis, and briefing synthesis, with exact version IDs shown in Settings), so a Google setup works without changes. If you configured only an Anthropic or OpenAI key, switch the slots to that provider's recommended lineup from the tables on the [Anthropic](/getting-started/api-keys-anthropic#_5-recommended-models), [Google](/getting-started/api-keys-google#_5-recommended-models), and [OpenAI](/getting-started/api-keys-openai#_6-recommended-models) setup pages. Mixing providers across slots also works whenever every selected slot has a valid API key. See [Model selection](/concepts/model-selection) for cost and quality trade-offs across stages.

Return to the <span class="ui-action">Pipeline</span> view once your categories and model slots are set.

## 4. Start the run and expect three pauses

The Pipeline view displays the six-stage Progress Timeline next to the <span class="ui-action">Start Analysis</span> button. By default, the pipeline pauses at three interactive review gates during the run so you can inspect intermediate results before the next stage executes:

<div style="margin: 1.5rem 0; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft);">
  <svg viewBox="0 0 680 390" style="width: 100%; height: auto; max-width: 680px; display: block; margin: 0 auto;" role="img" aria-label="Default pipeline flow showing the five automated stages interleaved with three interactive review gates">
    <defs>
      <marker id="fb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--vp-c-text-3)" />
      </marker>
    </defs>
    <rect x="40" y="12" width="600" height="38" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="36" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">1. Fetch papers</text>
    <text x="260" y="36" font-family="var(--vp-font-family-base)" font-size="12.5" fill="var(--vp-c-text-2)">Harvest new submissions from your arXiv categories</text>
    <line x1="340" y1="50" x2="340" y2="64" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#fb-arrow)" />
    <rect x="40" y="66" width="600" height="38" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="90" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">2. Filter papers</text>
    <text x="260" y="90" font-family="var(--vp-font-family-base)" font-size="12.5" fill="var(--vp-c-text-2)">Fast YES / MAYBE / NO abstract triage</text>
    <line x1="340" y1="104" x2="340" y2="118" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#fb-arrow)" />
    <rect x="65" y="120" width="550" height="34" rx="17" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="88" y="142" font-family="var(--vp-font-family-mono)" font-size="12.5" font-weight="700" fill="var(--vp-c-brand-1)">Gate 1 (pauseAfterFilter)</text>
    <text x="295" y="142" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-1)">Review buckets and override obvious filter misses</text>
    <line x1="340" y1="154" x2="340" y2="168" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#fb-arrow)" />
    <rect x="40" y="170" width="600" height="44" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="190" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">3. Score abstracts + 3.5. Post-process</text>
    <text x="58" y="206" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Assign 0.0 to 10.0 relevance scores with justifications and optional batch consistency pass</text>
    <line x1="340" y1="214" x2="340" y2="228" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#fb-arrow)" />
    <rect x="65" y="230" width="550" height="34" rx="17" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="85" y="252" font-family="var(--vp-font-family-mono)" font-size="11.5" font-weight="700" fill="var(--vp-c-brand-1)">Gate 2 (pauseBeforeDeepAnalysis)</text>
    <text x="305" y="252" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">Review scores and star or dismiss PDF candidates</text>
    <line x1="340" y1="264" x2="340" y2="278" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#fb-arrow)" />
    <rect x="40" y="280" width="600" height="38" rx="7" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="58" y="304" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="600" fill="var(--vp-c-text-1)">4. Analyze PDFs</text>
    <text x="260" y="304" font-family="var(--vp-font-family-base)" font-size="12.5" fill="var(--vp-c-text-2)">Full-text PDF read and technical report for the top N papers</text>
    <line x1="340" y1="318" x2="340" y2="332" stroke="var(--vp-c-text-3)" stroke-width="1.5" marker-end="url(#fb-arrow)" />
    <rect x="65" y="334" width="550" height="34" rx="17" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.5" />
    <text x="85" y="356" font-family="var(--vp-font-family-mono)" font-size="11.5" font-weight="700" fill="var(--vp-c-brand-1)">Gate 3 (pauseBeforeBriefing)</text>
    <text x="290" y="356" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">Star, dismiss, or comment before Stage 5 synthesis</text>
  </svg>
</div>

All three review gates are enabled by default and can be toggled off under Settings → Review & confirmation once you have calibrated your setup. On a first run, advancing through each gate after a brief inspection lets you see where the pauses occur and what controls they expose.

Click <span class="ui-action">Start Analysis</span>.

## 5. Fetch and filter, then the first pause

The progress timeline illuminates each stage in sequence. Fetching and initial abstract filtering run automatically before the first pause:

1. **Fetch papers**: Queries arXiv for new submissions across your configured categories.
2. **Filter papers**: Evaluates each abstract with the filter model in parallel batches and assigns a <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, or <span class="verdict is-no">NO</span> verdict.

When the filter stage finishes, the pipeline pauses at Gate 1. The main workspace displays the three verdict buckets, where each paper card includes a one-sentence summary, a brief justification, and clickable verdict pills that move the paper between buckets.

Scan how the papers were sorted across the three buckets. If a relevant paper appears in <span class="verdict is-no">NO</span>, click its verdict pill to move it to <span class="verdict is-maybe">MAYBE</span> or <span class="verdict is-yes">YES</span>; conversely, if an irrelevant paper appears in <span class="verdict is-yes">YES</span>, move it to <span class="verdict is-no">NO</span>. Every change records a `filter-override` feedback event that routes the paper appropriately on the current run and informs the [Suggest Improvements](/using/refining-over-time) refinement flow on later runs.

::: tip First-run habit
A brief scan suffices on your first run. Move any paper that is clearly in the wrong bucket, then click <span class="ui-action">Continue to scoring →</span>. Filter boundary patterns become easier to spot after several briefings.
:::

## 6. Scoring, then the second pause

The pipeline scores the surviving abstracts and runs the optional post-processing consistency pass, then pauses at Gate 2 (_"Score review"_) with a <span class="ui-action">Continue to PDF analysis →</span> button before downloading any PDFs. Gate 2 determines which papers receive a full-text PDF read.

The scored papers are organized into three collapsible groups: the **Will PDF (top-N)** group scheduled for Stage 4 under current settings, a **Borderline** band just below the cutoff, and a **Low score** group containing the remainder. Each row provides a **STAR** button that guarantees full-text PDF analysis regardless of score and a **DISMISS** button that excludes the paper from the PDF stage on this run. A free-text _"feedback on this scoring round"_ field in the banner records observations about the scoring distribution as a whole.

![The score-review gate displays a banner with the deep-read count and cost estimate above the Will PDF group, where each paper row carries STAR and DISMISS buttons.](/screenshots/gate-2-score-review.png)

_The score-review gate displays the projected cost of the PDF analysis stage at the top and provides per-paper STAR and DISMISS controls along each row._

On your first run, skim the top group and click <span class="ui-action">Continue to PDF analysis →</span> once the selection looks reasonable. For details on how stars and dismissals modify the Stage 4 candidate set, see [Review gates](/using/review-gates#gate-2-before-pdf-analysis-score-review).

## 7. PDF analysis

Stage 4 downloads, reads, and summarizes each selected PDF in parallel using a background worker pool. Because full-text PDF analysis processes tens of thousands of tokens per paper and respects arXiv's 15-second crawl delay between downloads, Stage 4 accounts for the largest share of run time, scaling with the number of selected papers, the chosen `pdfModel`, and your provider rate-limit tier.

You can step away from the browser while Stage 4 runs. The progress timeline and activity log update continuously as individual papers complete, and the active run persists across tab switches and page navigation.

## 8. Third pause: before the briefing writes

When PDF analysis completes, the pipeline pauses at Gate 3 and renders the Analysis Results list in the main workspace. Each paper card provides star, dismiss, and comment controls:

- <span class="ui-action">☆ star</span>: Marks the paper as high priority so that synthesis gives it deeper coverage and anchors a theme around it.
- <span class="ui-action">⊘ dismiss</span>: Marks the paper as low relevance so that synthesis deprioritizes it.
- <span class="ui-action">+ comment</span>: Attaches a short note that the synthesis model incorporates into the paper's write-up.

::: info You'll also notice a Download Report card
A <span class="ui-action">Download Report</span> card appears alongside the Analysis Results at Gate 3. That card exports a flat Markdown compilation of the per-paper Stage 4 technical reports for archiving or sharing, whereas the synthesized editorial **briefing** is generated in Stage 5 after this pause. See [The Download Report vs the briefing](/concepts/pipeline#the-download-report-vs-the-briefing) for a comparison of both outputs.
:::

On your first run, skim the deep-analysis results and click <span class="ui-action">Continue to briefing →</span> without starring or dismissing individual papers. When you are ready to steer synthesis and profile refinement actively, [Giving feedback](/using/giving-feedback) explains how each signal propagates downstream.

## 9. Read what you got

When synthesis and the hallucination audit finish, Aparture saves the briefing to the sidebar archive and switches the main workspace to the dedicated Briefing view. You can return to the stage-by-stage output at any time via the <span class="ui-action">Pipeline</span> navigation link.

The Pipeline and Briefing views organize the run output into the Analysis Results list, the Download Report card, the Briefing reading surface, and the Podcast generator:

| Block                | Where it lives           | What it is                                                                                                                                                    |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Analysis Results** | Pipeline view            | Interactive ranked paper list with scores (0.0–10.0; see [how scoring works](/concepts/pipeline#stage-3-score-abstracts)), justifications, and deep summaries |
| **Download Report**  | Pipeline view            | Flat Markdown compilation of the per-paper deep analyses (see [report vs briefing](/concepts/pipeline#the-download-report-vs-the-briefing))                   |
| **Briefing**         | Briefing view (archived) | Editorial reading surface containing the executive summary, thematic clusters, and paper cards                                                                |
| **Podcast**          | Briefing view            | Optional audio briefing bundle generator (see [Generating a podcast](/add-ons/podcast))                                                                       |

::: tip Expect the first briefing to be rough
On a first run, the pipeline operates on an unrefined starter profile without prior feedback or gate overrides. As you mark stars, dismissals, comments, and overrides across subsequent runs, the profile refinement loop sharpens both selection and synthesis.
:::

## Next

Continue to [Reading a briefing →](/using/reading-a-briefing) for a walkthrough of each section of the editorial view and a five-minute daily reading workflow.

Related guides:

- [**Giving feedback**](/using/giving-feedback): How stars, dismissals, comments, and filter overrides shape both immediate synthesis and subsequent runs.
- [**Writing a good profile**](/using/writing-a-profile): How to structure your research profile once you replace the starter template.
- [**Refining over time**](/using/refining-over-time): How Suggest Improvements turns accumulated feedback into atomic profile diffs.

If a stage failed during your run (such as zero fetched papers, a 429 rate-limit response, or a blocked PDF download), consult the [troubleshooting page](/reference/troubleshooting) by stage or re-run the diagnostic checks in [Verify setup](/getting-started/verify-setup).
