# Writing a good profile

Your profile is a block of natural-language prose describing what you work on, what methods you care about, and what you don't want to see. It's the primary input to Aparture: every pipeline stage reads it (quick filter, abstract scoring, post-processing, PDF analysis, briefing synthesis, NotebookLM generation), and every Suggest-Improvements call uses it as the baseline for proposed changes.

This page is about writing one that works. Most useful profiles are 150-300 words, so it doesn't take long — but getting the right 200 words takes some thought.

## What a profile is

A profile is a description of research interests in prose. It's not a keyword list, a set of hard rules, or a block of instructions for the LLM — it's the kind of paragraph you'd write if another researcher asked "what do you work on?"

The LLM reads it the way a well-intentioned collaborator would: to understand who you are, what you work on, what's adjacent to your work, and what you explicitly don't care about. You don't need to be clever or to anticipate how the LLM interprets specific words. Writing plainly is usually enough.

## What reads your profile

It's worth knowing where your profile actually lands:

- **Quick filter** (Stage 2) — decides whether to include or skip papers based on abstracts. Short prompts; your profile competes with the paper text for attention, so clarity matters.
- **Abstract scoring** (Stage 3) — assigns 0.0–10.0 relevance scores with justifications. Reads your profile as grounds for the relevance judgement. See [how scoring works](/concepts/pipeline#stage-3-score-abstracts) for the rubric.
- **Post-processing** (Stage 3.5, optional) — compares batches of papers for consistent ranking. Uses the profile indirectly, via scored justifications.
- **PDF analysis** (Stage 4) — deep-reads the top N papers. Uses your profile to frame the summary and adjust the score after seeing the full content.
- **Briefing synthesis** (Stage 5) — the big one. Uses your profile (plus your starred/dismissed papers and comments) to produce the executive summary, themes, and "why it matters" paragraphs.
- **Suggest-Improvements** — uses your profile as the baseline; proposes diffs against it based on your accumulated feedback.

Every refinement to the profile improves all of these downstream stages. A good profile is leveraged many times per run.

## What to include

Four things to think about.

### Methods you care about

Name the methodological families that are central to your work. "Hierarchical Bayesian models." "Transformer architectures." "Stochastic differential equations." "Variational autoencoders."

Be specific enough that the system can tell the difference between methods you use and methods that are just in your broad field. If you're a Bayesian astronomer, "Bayesian inference for cosmology" is more useful than "statistics" or "astronomy."

### Applications / domains

Where do you apply those methods? "Galaxy population inference." "NLP for clinical notes." "Protein structure prediction." "High-frequency trading."

Methods + applications together define the intersection where your interests live. A paper on transformers in genomics is different from a paper on transformers in NLP, and both are different from a paper on transformer theory.

### Breadth and depth preferences

Are you only interested in methodological papers, or also in applied ones? Do you care about theory papers? Review papers? How do you feel about empirical papers that just benchmark known methods?

State this explicitly. "I prefer methodological contributions over pure benchmarking." "I want a mix of applied and theoretical." "I don't care about review papers." These signals are interpreted by the filter and scoring stages.

### Anti-interests ("papers I don't want")

Name the things you explicitly don't want to see. This is often more impactful than listing what you do want — it tells the system where to _not_ pull papers from.

"Not interested in: vision-only papers without methodological contribution." "Not interested in purely empirical leaderboard papers." "Skip papers on reinforcement learning unless they have a new theoretical result."

Anti-interests are especially useful when your field overlaps with a much larger field that produces a lot of volume you don't care about (e.g. stats overlapping with ML).

## What to leave out

Some things sound like they'd help but actually make profiles worse:

- **Rigid rules.** "Always include papers from authors X, Y, Z." "Never include papers with more than 10 authors." These are brittle and the LLM may interpret them too literally or too loosely.
- **Keyword lists.** "Keywords: neural networks, deep learning, transformers, attention, optimization." These tell the filter what tokens to match on but miss the argument-level understanding that makes abstract scoring useful. A paper about transformers for optimization is different from a paper about optimization of transformers.
- **Instructions to the LLM.** "Be strict about relevance." "Prefer papers with code." "Include anything that mentions X." The LLM is already doing that kind of inference from your described interests; re-stating it as instruction just makes the profile noisier.
- **References to other users, teams, or profiles.** "Similar to Alice's research." These don't travel across context.
- **Negotiation language.** "I guess I'd be okay with…" — the LLM takes ambiguity seriously, so make affirmative statements.

## Two worked examples

### Narrow profile (single subfield, ~150 words)

> I work on hierarchical Bayesian models for galaxy population inference in
> observational cosmology. Specifically, I care about methods that let us
> combine noisy per-object measurements (redshifts, luminosities, shapes) into
> population-level statements about galaxy evolution, large-scale structure, or
> cosmological parameters.
>
> Methodological topics I actively follow:
>
> - Hierarchical Bayes and selection-effect modelling
> - Simulation-based inference (ABC, neural density estimation, normalizing flows)
> - Gaussian processes and their kernels for astronomical time series
> - Model comparison via marginal likelihoods
>
> I also follow adjacent work in statistics and machine learning when it
> introduces tools that transfer to my setting (e.g. a new SBI method benchmarked
> on a toy problem is relevant; a new image-classification benchmark is not).
>
> Not interested in:
>
> - Pure N-body simulations or purely theoretical cosmology without an
>   inferential contribution
> - Vision-only deep-learning papers
> - Reinforcement learning

Why this works: it names the intersection (Bayesian + galaxy populations + cosmology) unambiguously, lists concrete methods, flags the adjacency rule explicitly, and uses anti-interests to cut out the noisy neighbours (pure theory, vision, RL) that a naive filter might otherwise surface.

### Broad profile (interdisciplinary, ~200 words)

> I'm an interdisciplinary researcher working at the intersection of machine
> learning theory, computational physics, and statistical methodology. My work
> doesn't fit cleanly in one arXiv category, so I follow several fields.
>
> Machine learning side: I care about theoretical work on optimization,
> generalization, and the geometry of neural networks. I follow empirical work
> on transformers and diffusion models only when it introduces a new mechanism
> or a surprising result — not routine benchmark papers. I'm skeptical of
> benchmark-only contributions and of work that claims generality from narrow
> empirical studies.
>
> Physics side: I'm interested in ML-assisted simulation (neural surrogates,
> operator learning) and in physics-informed learning methods. Both
> lattice-physics and molecular-dynamics applications are in scope. I'm less
> interested in pure applied condensed-matter papers unless the ML contribution
> is substantial.
>
> Statistics side: I care about new inference methods for high-dimensional
> problems, especially variational and MCMC methods, and work at the boundary
> of probability theory and ML generalization.
>
> I don't want to see:
>
> - Computer vision papers unless they introduce a method with broader
>   applicability
> - Pure NLP / language-model capability papers
> - Quantum-computing ML papers unless they show real empirical gains
> - Reviews and position papers

Why this works: it covers three subfields without pretending they're unified; it uses a consistent "when it introduces X, not when it just does Y" pattern to discriminate within each subfield; and its anti-interests carve out the three largest neighbours (CV, NLP, quantum) that would otherwise dominate the output.

## Anti-patterns

A few failure modes to watch for.

### Keyword soup

> Deep learning, transformers, attention mechanisms, BERT, GPT, language models,
> NLP, machine translation, summarization, question answering, sentiment
> analysis, fine-tuning, pretraining, in-context learning, instruction tuning,
> RLHF, DPO, LoRA, PEFT.

This is a list of search terms. The filter will match on tokens but won't understand the _hierarchy_ or the _argument_. You'll get papers that mention these words in passing and miss papers that are deeply about these topics but use different terminology (e.g. "mixture-of-experts routing" when you meant "transformers").

**Better:** write sentences that explain your actual interests. "I work on efficient fine-tuning methods for large language models, especially parameter-efficient approaches like LoRA and QLoRA. I also follow instruction-tuning and preference-learning methods (RLHF, DPO)."

### Contradictory signals

> I'm interested in deep learning papers, especially new architectures.
> However, I'm also interested in statistics papers that don't use deep learning.
> I'm interested in applications in biology, but I don't really care about
> pure biology papers.

Each sentence is fine; together they're incoherent. The LLM will either pick one signal and ignore the others, or average them into vague noise. When you notice contradiction in your profile, either pick one direction or state the tension explicitly: "I work at the intersection of deep learning and classical statistics — papers that bridge both are the most interesting; pure-statistics or pure-ML papers are only relevant if they offer methods that generalise."

### Over-specification

> I am interested in papers that score at least 8.5 on the relevance scale.
> The filter should flag any paper with more than 12 authors. Always include
> papers from arXiv categories cs.LG and stat.ML on Mondays and Thursdays.

Profiles aren't configuration. Use Settings for thresholds and categories; use the profile for _what_ you care about, not _how_ the pipeline should work. Over-specified profiles often contradict the actual pipeline settings and confuse the LLM about what role the profile plays.

## Versioned history and rollback

When you change your profile, the old version isn't lost. Each save (manual edit or accepted Suggest-Improvements) creates a new entry in your **profile history**, with the previous version archived.

To review or restore an old version:

1. Go to **Profile** in the sidebar.
2. Find the **History** dropdown labelled "Revert to revision…".
3. Pick a timestamped snapshot. A diff preview shows you the difference from your current profile.
4. Click to revert, or close to keep your current version.

There's also a **Clear history** button for when your history has accumulated too much clutter. It wipes all revisions — the current profile stays intact.

::: info
Revert is non-destructive: it just swaps the current version, and the reverted-from version stays in history. You can always flip back.
:::

## Next

[Refining over time →](/using/refining-over-time) — with a baseline profile in place, this is the flow that turns accumulated stars, dismisses, and overrides into proposed profile edits you can accept or reject per hunk.

Also worth reading:

- You want to understand what each pipeline stage does with the profile. → [Pipeline](/concepts/pipeline)
- Your profile is fine but you want to tune how aggressively the pipeline filters. → [Tuning the pipeline](/using/tuning-the-pipeline)
