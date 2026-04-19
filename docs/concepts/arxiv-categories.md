# arXiv categories

The category set in your config determines which papers Aparture fetches each day. This page covers the category taxonomy, how cross-listings affect what you see, and a few selection patterns that tend to work in practice.

## What categories are

arXiv organises papers into a hierarchical taxonomy with major categories (top-level domains like `cs`, `math`, `stat`, `astro-ph`), subcategories within each domain (e.g. `cs.LG` for machine learning), and cross-listings where a single paper appears in multiple subcategories with one designated as primary.

Aparture fetches by subcategory. The selection lives in `config.selectedCategories`, and the default configuration covers machine learning, statistics, and astrophysics — edit it in the Settings view to match your field.

## Top-level divisions

The [full arXiv taxonomy](https://arxiv.org/category_taxonomy) lists 150+ subcategories. The major divisions you're most likely to care about:

| Prefix      | Domain                       |
| ----------- | ---------------------------- |
| `cs.*`      | Computer Science             |
| `math.*`    | Mathematics                  |
| `stat.*`    | Statistics                   |
| `astro-ph.*`| Astrophysics                 |
| `physics.*` | Physics (general)            |
| `hep-*`     | High-Energy Physics          |
| `q-bio.*`   | Quantitative Biology         |
| `econ.*`    | Economics                    |
| `eess.*`    | Electrical Engineering       |

Less common divisions (`cond-mat`, `gr-qc`, `nlin`, `nucl-ex`, `nucl-th`, `quant-ph`, `q-fin`) use the same `prefix.subcategory` pattern.

## Common subcategories by field

### Computer Science (`cs.*`)

Machine learning and AI:

- `cs.LG` — Machine Learning
- `cs.AI` — Artificial Intelligence
- `cs.CL` — Computation and Language (NLP)
- `cs.CV` — Computer Vision
- `cs.NE` — Neural and Evolutionary Computing

Theory and systems:

- `cs.CC` — Computational Complexity
- `cs.DS` — Data Structures and Algorithms
- `cs.LO` — Logic in Computer Science
- `cs.DC` — Distributed, Parallel, and Cluster Computing
- `cs.PL` — Programming Languages
- `cs.SE` — Software Engineering

Other frequently-crossed categories:

- `cs.CR` — Cryptography and Security
- `cs.DB` — Databases
- `cs.HC` — Human-Computer Interaction
- `cs.IR` — Information Retrieval
- `cs.RO` — Robotics

### Statistics (`stat.*`)

- `stat.ML` — Machine Learning (frequently cross-lists with `cs.LG`)
- `stat.ME` — Methodology
- `stat.AP` — Applications
- `stat.CO` — Computation
- `stat.TH` — Theory

### Mathematics (`math.*`)

Pure:

- `math.AG` — Algebraic Geometry
- `math.NT` — Number Theory
- `math.GT` — Geometric Topology
- `math.RT` — Representation Theory
- `math.CO` — Combinatorics

Applied:

- `math.NA` — Numerical Analysis
- `math.OC` — Optimization and Control
- `math.PR` — Probability
- `math.ST` — Statistics Theory
- `math.DS` — Dynamical Systems
- `math.MP` — Mathematical Physics

### Astrophysics (`astro-ph.*`)

- `astro-ph.CO` — Cosmology and Nongalactic Astrophysics
- `astro-ph.GA` — Astrophysics of Galaxies
- `astro-ph.SR` — Solar and Stellar Astrophysics
- `astro-ph.EP` — Earth and Planetary Astrophysics
- `astro-ph.HE` — High Energy Astrophysical Phenomena
- `astro-ph.IM` — Instrumentation and Methods

### Physics (other)

- `physics.comp-ph` — Computational Physics
- `physics.data-an` — Data Analysis, Statistics and Probability
- `physics.optics` — Optics
- `physics.plasm-ph` — Plasma Physics
- `hep-th` — High-Energy Physics, Theory
- `hep-ph` — High-Energy Physics, Phenomenology
- `hep-ex` — High-Energy Physics, Experiment

### Quantitative Biology (`q-bio.*`)

- `q-bio.BM` — Biomolecules
- `q-bio.GN` — Genomics
- `q-bio.NC` — Neurons and Cognition
- `q-bio.QM` — Quantitative Methods

### Economics (`econ.*`)

- `econ.EM` — Econometrics
- `econ.TH` — Theoretical Economics

### Electrical Engineering (`eess.*`)

- `eess.IV` — Image and Video Processing
- `eess.SP` — Signal Processing
- `eess.SY` — Systems and Control

::: info Full taxonomy
The full list (including less-common categories like `cond-mat.*`, `gr-qc`, and `quant-ph`) lives at [arxiv.org/category_taxonomy](https://arxiv.org/category_taxonomy).
:::

## How cross-listings work

Papers often appear in more than one subcategory. A typical machine-learning paper might be primary in `cs.LG` and cross-listed in `stat.ML` and `cs.AI`, which means it'll show up regardless of whether you select `cs.LG` alone or `cs.LG` plus `stat.ML`.

Aparture deduplicates across categories — selecting both `cs.LG` and `stat.ML` won't double-count the paper. The sorting metadata Aparture receives from arXiv shows each paper's primary category, so you can see where the author filed it originally.

In practice this means more categories gives you better coverage rather than more noise. The filter model (and your profile) handles relevance filtering downstream, so over-including categories is usually cheaper than under-including them.

## Selection patterns

Three broad approaches, each with a different volume-and-signal profile.

### Narrow and focused

Two or three highly-relevant categories. Suits clear research interests and limited daily reading time.

*Example — deep learning for galaxy evolution:*

```
cs.LG
astro-ph.GA
astro-ph.CO
```

Typical volume: 5–15 papers/day. The filter rarely needs to work hard; signal-to-noise tends to be high. The risk is missing work that cross-lists elsewhere — a paper primary in `stat.ML` or `astro-ph.IM` that matters for your topic won't appear unless you add those categories too.

### Broad and exploratory

Four to seven categories spanning methodological and domain interests. Suits interdisciplinary work or when you're actively scouting for adjacent ideas.

*Example — Bayesian methods across fields:*

```
stat.ME
stat.ML
astro-ph.IM
physics.data-an
econ.EM
```

Typical volume: 20–50 papers/day. Costs more per run and puts more load on the filter, but cross-field connections surface that narrow configurations miss.

### Domain-comprehensive

Every subcategory in one domain, plus one or two methodological crosses. Suits deep expertise in one field where missing anything is a larger cost than a heavier daily triage.

*Example — full astrophysics coverage:*

```
astro-ph.CO
astro-ph.GA
astro-ph.SR
astro-ph.EP
astro-ph.HE
astro-ph.IM
physics.comp-ph
stat.AP
```

Typical volume: 30–80 papers/day. This usually benefits from a stricter filter model and a lower final-output count — see [Tuning the pipeline](/using/tuning-the-pipeline) for thresholds to adjust.

## Categories and profile work together

Category selection controls the funnel; your profile controls what scores well inside it. The two are complementary.

**Broad categories, narrow profile.** Cast a wide net at fetch time, let the profile and filter cut aggressively. Good when you want occasional cross-field hits without living in every subcategory daily.

```
Categories: cs.AI, cs.LG, cs.CV, cs.CL
Profile: heavily focused on "Bayesian deep learning"
```

**Narrow categories, broad profile.** Pre-filter at fetch time, let the profile be permissive. Good when you trust the categories to match your interest area and don't want to write a detailed profile yet.

```
Categories: cs.LG, stat.ML
Profile: "Any machine learning advance"
```

The first pattern costs more per run (more papers fetched, more filter calls) but surfaces more cross-field work. The second is cheaper and simpler but depends on the categories being well-chosen for your field.

## Common starting configurations

Three configurations that tend to work as starting points. Adjust based on what the first few runs surface.

### Machine learning researcher

```
Core: cs.LG, cs.AI, stat.ML
Optional: cs.CV, cs.CL
```

Typical volume: 20–40 papers/day.

### Computational astrophysicist

```
Core: astro-ph.CO, astro-ph.GA, astro-ph.IM
Optional: physics.comp-ph, physics.data-an, stat.AP
```

Typical volume: 15–35 papers/day.

### Applied statistician

```
Core: stat.ME, stat.AP, stat.ML
Optional: cs.LG, econ.EM
```

Typical volume: 10–25 papers/day.

### Theoretical CS

```
Core: cs.CC, cs.DS, cs.LO
Optional: math.CO, cs.CR
```

Typical volume: 5–15 papers/day.

## Fetch behaviour and rate limits

arXiv's OAI API limits requests to one every three seconds and caps each response at 1000 papers. Aparture respects those limits automatically — it paginates large result sets and batches across categories.

Fetch time scales roughly with category count:

| Categories   | Fetch time (approx.) |
| ------------ | -------------------- |
| 1–3          | ~1 minute            |
| 5–10         | ~2–3 minutes         |
| 20+          | ~5–10 minutes        |

Fetching is the shortest stage of the pipeline regardless — the time-dominant stages are PDF analysis and briefing synthesis, so adding categories rarely matters for overall runtime.

## Taxonomy changes

arXiv occasionally updates the taxonomy. Recent changes that still show up in older configs:

- 2020 added the `eess.*` division (Electrical Engineering).
- 2017 reorganised several `cs.*` subcategories.
- 2016 added the `econ.*` division.

If you notice a subcategory that looks relevant but isn't in your config, add it and re-run — there's no cost to including an extra category beyond the marginal fetch time.

## Next

- [The pipeline →](/concepts/pipeline) — what happens after papers are fetched.

Also worth reading:

- [Model selection](/concepts/model-selection) — pick a `filterModel` calibrated to your category volume.
- [Tuning the pipeline](/using/tuning-the-pipeline) — thresholds and batch sizes to adjust if your category set produces a heavy daily volume.
- [Your first briefing](/using/first-briefing) — walkthrough of a full run end-to-end.
