# Writing a good profile

Your research profile is the prose document at the top of the Profile page that defines your scientific interests for Aparture. Because every stage of the pipeline reads this document to evaluate relevance, spending a few minutes writing a clear, specific profile improves filtering, scoring, full-text analysis, and synthesis across every subsequent run.

Effective profiles typically run 150 to 300 words. A well-structured profile gives the pipeline clear positive and negative scope boundaries so that briefings focus on your actual research problems instead of generic subfield averages.

## What a profile is

A profile is a plain-prose description of your research agenda written the way you would explain your work to a new scientific collaborator. The pipeline's language models read this prose to identify your core methodological tools, target application domains, relevant adjacent areas, and explicit exclusions. Clear, direct sentences describing your research problems work much better than keyword lists or prompt-engineering directives.

## Starter templates

On a fresh installation, the Profile page displays a starter template picker containing four example profiles (`Focused: Bayesian cosmology`, `Breadth: ML + statistics + astrophysics`, `Applied machine learning`, and `Fill-in template`), each paired with a matching arXiv category list. Selecting a template populates both your profile text and your category configuration so you can observe a complete run before substituting your own research description.

![The starter template picker at the top of the Profile page shows four template cards, each with a short description, a category count, and a "Use this template" button, above the profile text box.](/screenshots/template-picker.png)

_The starter template picker on a fresh installation fills the profile editor and selects matching arXiv categories in a single click._

| Template                                    | Shape                                                                                                     | Categories                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Focused: Bayesian cosmology**             | A focused single-subfield profile corresponding to the first worked example below                         | `astro-ph.CO` + `astro-ph.IM`         |
| **Breadth: ML + statistics + astrophysics** | A broad multi-archive profile spanning three disciplines (19 subcategories; highest token volume per run) | 19 categories across cs/stat/astro-ph |
| **Applied machine learning**                | Practical methodology paired with rigorous empirical evaluation                                           | `cs.LG` + `stat.ML` + `cs.CL`         |
| **Fill-in template**                        | Structured prose with bracketed placeholders for your own field, methods, and exclusions                  | `cs.LG` + `stat.ML`                   |

The template picker remains visible only while your profile matches the unmodified initial template. Once you save an edit or dismiss the picker, the Profile view displays the profile editor directly.

## What reads your profile

Every stage of the pipeline consults your profile text when evaluating or synthesizing papers:

| Stage                                     | How the profile gets used                                                                                                                                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage 2: quick filter**                 | Triages each abstract into <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, or <span class="verdict is-no">NO</span> buckets. Because the filter prompt is compact, clear topical boundaries and explicit exclusions have the largest impact here. |
| **Stage 3: abstract scoring**             | Assigns a 0.0–10.0 relevance score and a 2–3 sentence justification grounded directly in your profile (see [how scoring works](/concepts/pipeline#stage-3-score-abstracts)).                                                                                                            |
| **Stage 3.5: post-processing (optional)** | Re-scores the top papers in comparative batches using your profile alongside each paper's Stage 3 score and justification.                                                                                                                                                              |
| **Stage 4: PDF analysis**                 | Guides the full-text technical report and updates the paper's relevance score after reading the complete PDF.                                                                                                                                                                           |
| **Stage 5: briefing synthesis**           | Frames the executive summary, thematic clusters, and per-paper _"why it matters"_ paragraphs by combining your profile with your stars, dismissals, and comments.                                                                                                                       |
| **The refinement flow**                   | Serves as the baseline document against which **Suggest improvements** computes atomic diffs.                                                                                                                                                                                           |

Because every stage reads the same profile, a single clarification in your profile prose propagates immediately across filtering, scoring, deep analysis, and synthesis.

## What to include

An effective profile specifies the methods you use, your application domains, your preferences for methodological versus applied breadth, and explicit anti-interests.

### Methods you care about

Name the specific methodological families central to your research, such as _"hierarchical Bayesian models"_, _"transformer architectures"_, _"stochastic differential equations"_, or _"variational autoencoders"_. Naming concrete methods lets the pipeline distinguish tools you actively develop or apply from unrelated techniques in the same broad discipline. For example, specifying _"Bayesian inference and simulation-based inference for cosmology"_ gives the filter much sharper guidance than writing _"statistics"_ or _"astronomy"_.

### Applications and domains

Specify the physical, biological, or empirical systems where you apply those methods, such as _"galaxy population inference"_, _"natural language processing for clinical notes"_, _"protein structure prediction"_, or _"high-frequency market microstructure"_. Pairing methods with domains defines the exact intersection you care about, allowing the scoring model to distinguish a paper on transformers for genomics from a paper on transformer optimization theory.

### Breadth and depth preferences

State explicitly whether you prioritize new methodological contributions, theoretical guarantees, empirical benchmarks, or review articles. Including a direct preference statement such as _"I prefer methodological contributions over pure benchmarking"_, _"I want a mix of applied and theoretical work"_, or _"I do not read survey or review papers"_ calibrates both the Stage 2 filter and the Stage 3 scoring rubric.

### Anti-interests

A profile that lists only positive topics often admits large volumes of adjacent papers from neighboring high-volume categories. Stating explicit exclusions shifts filter precision more effectively than expanding positive descriptions alone:

- _"Not interested in computer-vision papers without a general methodological contribution."_
- _"Not interested in purely empirical leaderboard papers."_
- _"Skip reinforcement learning papers unless they establish a new theoretical convergence result."_

Explicit anti-interests are particularly effective when your field shares arXiv categories with a higher-volume discipline (such as statistical methodology overlapping with deep learning in `stat.ML` and `cs.LG`).

## What to leave out

Avoid patterns that degrade LLM relevance judgment or conflict with pipeline settings:

- **Rigid author or metadata rules**: Statements such as _"Always include papers from authors X, Y, Z"_ or _"Never include papers with more than 10 authors"_ are brittle and distract from topical evaluation.
- **Unstructured keyword lists**: Lists such as _"Keywords: neural networks, deep learning, transformers, attention, optimization"_ encourage surface token matching rather than argument-level comprehension, admitting papers that mention a term in passing while missing papers that address the same problem under different terminology.
- **Meta-instructions to the language model**: Directives such as _"Be strict about relevance"_ or _"Prefer papers with code"_ belong in [editorial notes](#editorial-notes) or prompt templates rather than the research profile itself.
- **Unanchored personal references**: Phrases such as _"Similar to Alice's research group"_ provide no context to the model unless the underlying topics are stated explicitly.
- **Hedging language**: Replace tentative phrasing (_"I guess I might be interested in…"_) with direct declarative statements of scope.

## Worked examples: narrow and broad profiles {#two-worked-examples}

### Narrow profile (single subfield, ~150 words)

> I work on hierarchical Bayesian models for galaxy population inference in
> observational cosmology. Specifically, I care about methods that let us
> combine noisy per-object measurements (redshifts, luminosities, shapes)
> into population-level statements about galaxy evolution, large-scale
> structure, or cosmological parameters.
>
> Methodological topics I actively follow:
>
> - Hierarchical Bayes and selection-effect modelling
> - Simulation-based inference (ABC, neural density estimation,
>   normalizing flows)
> - Gaussian processes and their kernels for astronomical time series
> - Model comparison via marginal likelihoods
>
> I also follow adjacent work in statistics and machine learning when it
> introduces tools that transfer to my setting (e.g. a new SBI method
> benchmarked on a toy problem is relevant; a new image-classification
> benchmark is not).
>
> Not interested in:
>
> - Pure N-body simulations or purely theoretical cosmology without an
>   inferential contribution
> - Vision-only deep-learning papers
> - Reinforcement learning

This profile succeeds because it defines the core intersection (Bayesian inference, galaxy populations, and observational cosmology), enumerates specific methodological families, states an explicit rule for when adjacent statistics or ML papers transfer, and carves out high-volume neighboring topics (pure theory, computer vision, and reinforcement learning).

### Broad profile (interdisciplinary, ~200 words)

> I'm an interdisciplinary researcher working at the intersection of
> machine learning theory, computational physics, and statistical
> methodology. My work doesn't fit cleanly in one arXiv category, so I
> follow several fields.
>
> Machine learning side: I care about theoretical work on optimization,
> generalization, and the geometry of neural networks. I follow empirical
> work on transformers and diffusion models only when it introduces a new
> mechanism or a surprising result, rather than routine benchmark papers. I'm
> skeptical of benchmark-only contributions and of work claiming
> generality from narrow empirical studies.
>
> Physics side: I'm interested in ML-assisted simulation (neural
> surrogates, operator learning) and in physics-informed learning
> methods. Both lattice-physics and molecular-dynamics applications are
> in scope. I'm less interested in pure applied condensed-matter papers
> unless the ML contribution is substantial.
>
> Statistics side: I care about new inference methods for high-dimensional
> problems, especially variational and MCMC methods, and work at the
> boundary of probability theory and ML generalization.
>
> I don't want to see:
>
> - Computer vision papers unless they introduce a method with broader
>   applicability
> - Pure NLP / language-model capability papers
> - Quantum-computing ML papers unless they show real empirical gains
> - Reviews and position papers

This interdisciplinary profile succeeds because it separates the three constituent fields clearly, specifies the exact condition under which empirical or applied papers qualify inside each domain, and excludes the three largest neighboring literature streams (computer vision, capability-focused NLP, and quantum ML) that would otherwise dominate the daily fetch.

## Anti-patterns

### Keyword soup

> Deep learning, transformers, attention mechanisms, BERT, GPT, language
> models, NLP, machine translation, summarization, question answering,
> sentiment analysis, fine-tuning, pretraining, in-context learning,
> instruction tuning, RLHF, DPO, LoRA, PEFT.

Because a comma-separated term list provides no hierarchy or research question, the filter matches isolated tokens while missing papers that study the same mechanism under more specific terminology (such as _"mixture-of-experts routing"_).

**Improved formulation**: Write complete sentences that state the problem and method family: _"I work on parameter-efficient fine-tuning methods for large language models, particularly low-rank adaptation approaches such as LoRA and QLoRA, alongside instruction-tuning and preference-optimization methods (RLHF and DPO)."_

### Contradictory signals

> I'm interested in deep learning papers, especially new architectures.
> However, I'm also interested in statistics papers that don't use deep
> learning. I'm interested in applications in biology, but I don't really
> care about pure biology papers.

When adjacent sentences pull in opposite directions without stating how they relate, the scoring model either averages them into bland mid-range scores or latches onto one clause arbitrarily. State the unifying criterion directly: _"I work at the intersection of deep learning and classical statistical methodology, with applications to quantitative biology; pure statistics or pure ML papers are relevant only when their methods transfer to biological data."_

### Over-specification

> I am interested in papers that score at least 8.5 on the relevance
> scale. The filter should flag any paper with more than 12 authors.
> Always include papers from arXiv categories cs.LG and stat.ML on
> Mondays and Thursdays.

Operational parameters such as category lists, score cutoffs, and schedules belong in **Settings** rather than in the prose profile. Mixing operational rules into the profile text creates conflicts with your actual Settings configuration.

## Versioned history and rollback

Every modification to your profile (whether from a manual save, an accepted refinement suggestion, a starter template selection, a revert, or a switch between named profiles) archives the previous profile text and editorial notes as a snapshot in your **profile history** (retaining the 20 most recent revisions).

To inspect or restore an earlier revision:

1. Open <span class="ui-action">Profile</span> in the left sidebar.
2. Expand the <span class="ui-action">History</span> disclosure beneath the profile editor.
3. Review the chronological revision list (newest first). Each entry displays the timestamp, the change source tag (`manual`, `suggested`, `template`, `revert`, or `switch`), the number of lines added and removed, and the change rationale (including how many diffs were accepted on a `suggested` revision). Click any entry to inspect its line-by-line diff and full prior text.
4. Click <span class="ui-action">Revert</span> on an entry to restore the profile text and editorial notes from before that change.

Clicking <span class="ui-action">Clear history</span> purges the archived revision list while leaving your active profile untouched.

::: info
Reverting is non-destructive: Aparture archives your current text as a new history entry before restoring the older snapshot, so you can always undo a revert. Reverting past a `suggested` revision also resets the feedback events incorporated by those later revisions back to **pending** status so the refinement flow can evaluate them again.
:::

## Named profiles

You can maintain multiple named profiles and switch between them for different workflows, such as your primary research agenda, an exploratory side project, or a broad conference-season literature sweep. The profile switcher sits at the top of the Profile page with a dropdown displaying the active profile alongside <span class="ui-action">Save as…</span>, <span class="ui-action">Rename</span>, and <span class="ui-action">Delete</span> controls.

![The Profile page displays the named-profile switcher at the top with a PROFILE dropdown showing "Default" next to Save as…, Rename, and Delete buttons, above the profile text box and the Suggest improvements card.](/screenshots/profile-switcher.png)

_The named-profile switcher above the editor selects which profile snapshot is active for pipeline runs and refinement calls._

Each named profile stores an independent snapshot of your profile text and [editorial notes](#editorial-notes):

- <span class="ui-action">Save changes</span> writes edits (as well as accepted suggestions and reverts) directly into the currently active profile.
- <span class="ui-action">Save as…</span> duplicates the current text and editorial notes under a new name and activates the new copy while leaving the original profile unchanged. Duplicate profile names are rejected to prevent accidental overwrites.
- Selecting a different profile in the dropdown loads its text and editorial notes into the workspace while preserving your outgoing profile snapshot and logging the switch in revision history.

Each pipeline run evaluates only the single currently active profile, and all named profiles share one unified feedback stream of stars, dismissals, and comments.

## Editorial notes

While your research profile specifies _what_ topics you study, **editorial notes** specify _how_ the pipeline should judge borderline cases and format your outputs (for example, _"Benchmark-only papers count as adjacent"_, _"Open each theme with its quantitative result before describing the method"_, or _"Keep the podcast brisk"_). Editorial notes live on the <span class="ui-action">Editorial notes</span> tab next to the profile editor.

Every editorial note belongs to one of three routing scopes that determine which pipeline prompts receive it:

| Scope     | Reaches                                                                  |
| --------- | ------------------------------------------------------------------------ |
| Selection | Quick filter, abstract scoring, Stage 3.5 score review, and PDF analysis |
| Writing   | Stage 5 briefing synthesis and post-briefing editor questions            |
| Podcast   | Discussion-guide focus prompt in the podcast bundle                      |

Inside those prompts, the active scope's notes are appended directly beneath your research profile under a precedence rule stating that the research profile governs whenever a note and the profile conflict. The Stage 5 hallucination audit receives no editorial notes because it verifies factual grounding against source text regardless of stylistic preferences.

Editorial notes change only when you add, edit, or delete them on the tab or accept a note diff proposed by the [refinement flow](/using/refining-over-time). All note changes are versioned alongside the profile text in revision history. Each scope holds up to 12 notes; once a scope reaches 12 notes, the refinement flow proposes revising or retiring an existing note when incorporating new stylistic feedback.

As a division of labor, place topical additions, narrowing rules, and subfield exclusions in the research profile, and place preferences about incremental work, code availability, or briefing prose structure in editorial notes.

## Next

Continue to [Refining over time →](/using/refining-over-time) to see how accumulated stars, dismissals, comments, overrides, and answers are converted into reviewable diffs against your profile and editorial notes.

Related guides:

- [**The pipeline**](/concepts/pipeline): How each stage uses your profile and editorial notes from fetch to synthesis.
- [**Tuning the pipeline**](/using/tuning-the-pipeline): How to adjust stage models, batch sizes, and candidate counts alongside your profile.
- [**Giving feedback**](/using/giving-feedback): Overview of the seven feedback signals that feed profile refinement.
