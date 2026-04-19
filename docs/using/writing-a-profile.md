# Writing a good profile

Once you've given feedback on a briefing or two, the natural next question is how to put those instincts into the profile itself. Your profile is the block of prose at the top of the Profile page — the single source of what Aparture thinks you care about, and the only thing every pipeline stage reads. A few minutes spent on it pays off across every run after.

Most useful profiles are 150–300 words, so this isn't a big writing exercise. But getting the right 200 words takes some thought, and a rushed profile tends to produce briefings that drift toward whatever the filter model considers vaguely relevant to your field.

## What a profile is

A profile is a description of research interests in prose. It's not a keyword list, a set of hard rules, or a block of instructions to the LLM — it's the kind of paragraph you'd write if a new collaborator asked what you work on.

The pipeline's LLMs read it the way that collaborator would: to understand who you are, what you work on, what's adjacent to your work, and what you explicitly don't care about. You don't need to be clever about wording or anticipate how the model interprets specific words. Writing plainly is usually enough.

## What reads your profile

It's worth knowing where your profile actually lands in the pipeline. Every stage reads it:

| Stage                                     | How the profile gets used                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage 2 — quick filter**                | Triages each paper as <span class="verdict is-yes">YES</span> / <span class="verdict is-maybe">MAYBE</span> / <span class="verdict is-no">NO</span> from the abstract. The prompt is short, so the profile competes with the paper text for attention; clarity matters most here. |
| **Stage 3 — abstract scoring**            | Assigns a 0–10 relevance score with a short justification. The profile is the grounds for that judgement. See [how scoring works](/concepts/pipeline#stage-3-score-abstracts) for the rubric. |
| **Stage 3.5 — post-processing (optional)**| Re-scores top papers in batches for consistency. The profile feeds in indirectly through the Stage 3 justifications.                                            |
| **Stage 4 — PDF analysis**                | Deep-reads the top N papers. The profile frames the summary and adjusts the score after the model has seen the full content.                                   |
| **Stage 5 — briefing synthesis**          | Produces the executive summary, themes, and "why it matters" paragraphs, weighing your profile against your starred, dismissed, and commented papers.           |
| **The refinement flow**                   | When you ask the tool to propose profile edits, your current profile is the baseline it diffs against.                                                          |

Because every stage reads it, a single refinement to the profile shows up in every downstream decision the pipeline makes. A good profile does a lot of work per run.

## What to include

Four things are usually worth covering.

### Methods you care about

Name the methodological families central to your work. *"Hierarchical Bayesian models."* *"Transformer architectures."* *"Stochastic differential equations."* *"Variational autoencoders."*

Be specific enough that the pipeline can tell the difference between methods you use and methods that are just in your broad field. A Bayesian astronomer writing *"Bayesian inference for cosmology"* gives the filter more to reason about than *"statistics"* or *"astronomy."*

### Applications and domains

Where do you apply those methods? *"Galaxy population inference."* *"NLP for clinical notes."* *"Protein structure prediction."* *"High-frequency trading."*

Methods plus applications together define the intersection where your interests live. A paper on transformers in genomics is a different paper from one on transformers in NLP, and both are different from a paper on transformer theory.

### Breadth and depth preferences

The pipeline can't infer whether you're after methodological contributions, empirical benchmarks, theory papers, or review articles — it'll try to give you a mix unless you say otherwise. A sentence or two in the profile saves a lot of downstream confusion: *"I prefer methodological contributions over pure benchmarking."* *"I want a mix of applied and theoretical."* *"I don't care about review papers."* Both the filter and scoring stages lean on this kind of signal.

### Anti-interests

A profile that only describes what you want tends to produce briefings that over-select on adjacent work. Spelling out what you *don't* want — as directly as the rest of the profile — usually shifts the output more than the positive descriptions do:

*"Not interested in vision-only papers without methodological contribution."* *"Not interested in purely empirical leaderboard papers."* *"Skip papers on reinforcement learning unless they present a new theoretical result."*

Anti-interests matter most when your field overlaps with a much larger field producing a lot of volume you don't care about (e.g. statistics overlapping with ML).

## What to leave out

A few things sound like they'd help but usually make profiles worse.

- **Rigid rules.** *"Always include papers from authors X, Y, Z."* *"Never include papers with more than 10 authors."* These are brittle; the LLM either takes them too literally or ignores them entirely.
- **Keyword lists.** *"Keywords: neural networks, deep learning, transformers, attention, optimization."* These nudge the filter toward token matching and miss the argument-level understanding that makes abstract scoring useful. A paper *about* transformers-for-optimization is a different paper from one about optimization *of* transformers.
- **Instructions to the LLM.** *"Be strict about relevance."* *"Prefer papers with code."* The models are already doing that kind of inference from your described interests; re-stating it as instruction just makes the profile noisier.
- **References to other researchers or teams.** *"Similar to Alice's research."* These don't travel — the LLM has no idea who Alice is.
- **Hedging language.** *"I guess I'd be okay with…"* The model takes ambiguity seriously, so prefer affirmative statements.

## Two worked examples

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

This works because it names the intersection (Bayesian + galaxy populations + cosmology) unambiguously, lists concrete methods, flags the adjacency rule explicitly, and uses anti-interests to cut out the noisy neighbours — pure theory, vision, RL — that a naive filter would otherwise surface.

### Broad profile (interdisciplinary, ~200 words)

> I'm an interdisciplinary researcher working at the intersection of
> machine learning theory, computational physics, and statistical
> methodology. My work doesn't fit cleanly in one arXiv category, so I
> follow several fields.
>
> Machine learning side: I care about theoretical work on optimization,
> generalization, and the geometry of neural networks. I follow empirical
> work on transformers and diffusion models only when it introduces a new
> mechanism or a surprising result — not routine benchmark papers. I'm
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

This works because it covers three subfields without pretending they're unified; it uses a consistent *"when it introduces X, not when it just does Y"* pattern to discriminate within each subfield; and its anti-interests carve out the three largest neighbours — CV, NLP, quantum — that would otherwise dominate the output.

## Anti-patterns

A few failure modes worth spotting in your own drafts.

### Keyword soup

> Deep learning, transformers, attention mechanisms, BERT, GPT, language
> models, NLP, machine translation, summarization, question answering,
> sentiment analysis, fine-tuning, pretraining, in-context learning,
> instruction tuning, RLHF, DPO, LoRA, PEFT.

This is a list of search terms. The filter matches on tokens but doesn't understand the hierarchy or the argument. You'll get papers that mention these words in passing and miss papers that are deeply about these topics but use different terminology (e.g. *"mixture-of-experts routing"* when you meant transformers).

**Better:** write sentences that explain your actual interests. *"I work on efficient fine-tuning methods for large language models, especially parameter-efficient approaches like LoRA and QLoRA. I also follow instruction-tuning and preference-learning methods (RLHF, DPO)."*

### Contradictory signals

> I'm interested in deep learning papers, especially new architectures.
> However, I'm also interested in statistics papers that don't use deep
> learning. I'm interested in applications in biology, but I don't really
> care about pure biology papers.

Each sentence is fine; together they're incoherent. The LLM tends to either pick one signal and ignore the others, or average them into vague noise. When you notice contradiction in your own profile, pick one direction — or state the tension explicitly: *"I work at the intersection of deep learning and classical statistics. Papers that bridge both are most interesting; pure-statistics or pure-ML papers only register if they offer methods that generalise."*

### Over-specification

> I am interested in papers that score at least 8.5 on the relevance
> scale. The filter should flag any paper with more than 12 authors.
> Always include papers from arXiv categories cs.LG and stat.ML on
> Mondays and Thursdays.

Profiles aren't configuration. Thresholds and categories live in Settings; the profile carries *what* you care about, not *how* the pipeline should work. Over-specified profiles often contradict the actual settings and confuse the model about what role the profile is playing.

## Versioned history and rollback

When you change your profile, the old version isn't lost. Each save — manual edit or accepted suggestion from the refinement flow — creates a new entry in your **profile history**, with the previous version archived. The history keeps the last 20 revisions.

To review or restore an older version:

1. Open <span class="ui-action">Profile</span> in the sidebar.
2. Expand the <span class="ui-action">History</span> control beneath the profile text box.
3. Pick a timestamped snapshot to see the full profile content at that revision. Suggested revisions also show the rationale that was accepted.
4. Click <span class="ui-action">Revert</span> on the snapshot to restore it.

There's also a <span class="ui-action">Clear history</span> button for when revisions have accumulated beyond what's useful. It wipes the history list but leaves your current profile intact.

::: info
Reverting is non-destructive — the current version moves into history as a new revision before the snapshot takes its place, so you can always flip back.
:::

## Next

[Refining over time →](/using/refining-over-time) — with a baseline profile in place, this is the flow that turns accumulated stars, dismisses, comments, and overrides into proposed edits you can accept or reject per change.

Also worth reading:

- You want to understand what each pipeline stage does with the profile. → [Pipeline](/concepts/pipeline)
- Your profile is fine but you want to tune how aggressively the pipeline filters. → [Tuning the pipeline](/using/tuning-the-pipeline)
- A reminder of what each feedback type contributes. → [Giving feedback](/using/giving-feedback)
