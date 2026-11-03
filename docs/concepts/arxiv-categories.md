# arXiv categories

Your selected arXiv categories define the daily submission stream that Aparture harvests in Stage 1. The arXiv category taxonomy, cross-listing deduplication rules, and category-to-profile pairing determine how many papers enter your run each day.

## What categories are

arXiv organizes preprints into a two-level taxonomy consisting of top-level archives (such as `cs`, `math`, `stat`, and `astro-ph`) and subject subcategories within each archive (such as `cs.LG` for Machine Learning). Authors assign each submission one primary subcategory and may cross-list it into additional subcategories across the same or different archives.

Aparture harvests papers by subcategory according to `config.selectedCategories`. A fresh installation defaults to `cs.LG` and `stat.ML`, and selecting a starter template on the Profile page replaces that list with the template's matched categories. You can add or remove subcategories at any time in the **Settings** view.

## Top-level divisions

The [complete arXiv category taxonomy](https://arxiv.org/category_taxonomy) defines more than 150 subcategories across these primary archives:

| Prefix       | Domain                 |
| ------------ | ---------------------- |
| `cs.*`       | Computer Science       |
| `math.*`     | Mathematics            |
| `stat.*`     | Statistics             |
| `astro-ph.*` | Astrophysics           |
| `physics.*`  | Physics (general)      |
| `hep-*`      | High-Energy Physics    |
| `q-bio.*`    | Quantitative Biology   |
| `econ.*`     | Economics              |
| `eess.*`     | Electrical Engineering |

Additional physics and quantitative archives (`cond-mat`, `gr-qc`, `nlin`, `nucl-ex`, `nucl-th`, `quant-ph`, and `q-fin`) follow the same `prefix.subcategory` naming convention.

## Common subcategories by field

### Computer Science (`cs.*`)

Machine learning, language, and vision subcategories:

- `cs.LG`: Machine Learning
- `cs.AI`: Artificial Intelligence
- `cs.CL`: Computation and Language (NLP)
- `cs.CV`: Computer Vision
- `cs.NE`: Neural and Evolutionary Computing

Theory and systems subcategories:

- `cs.CC`: Computational Complexity
- `cs.DS`: Data Structures and Algorithms
- `cs.LO`: Logic in Computer Science
- `cs.DC`: Distributed, Parallel, and Cluster Computing
- `cs.PL`: Programming Languages
- `cs.SE`: Software Engineering

Frequently cross-listed computer science subcategories:

- `cs.CR`: Cryptography and Security
- `cs.DB`: Databases
- `cs.HC`: Human-Computer Interaction
- `cs.IR`: Information Retrieval
- `cs.RO`: Robotics

### Statistics (`stat.*`)

- `stat.ML`: Machine Learning (frequently cross-listed with `cs.LG`)
- `stat.ME`: Methodology
- `stat.AP`: Applications
- `stat.CO`: Computation
- `stat.TH`: Theory

### Mathematics (`math.*`)

Pure mathematics subcategories:

- `math.AG`: Algebraic Geometry
- `math.NT`: Number Theory
- `math.GT`: Geometric Topology
- `math.RT`: Representation Theory
- `math.CO`: Combinatorics

Applied and probabilistic mathematics subcategories:

- `math.NA`: Numerical Analysis
- `math.OC`: Optimization and Control
- `math.PR`: Probability
- `math.ST`: Statistics Theory
- `math.DS`: Dynamical Systems
- `math.MP`: Mathematical Physics

### Astrophysics (`astro-ph.*`)

- `astro-ph.CO`: Cosmology and Nongalactic Astrophysics
- `astro-ph.GA`: Astrophysics of Galaxies
- `astro-ph.SR`: Solar and Stellar Astrophysics
- `astro-ph.EP`: Earth and Planetary Astrophysics
- `astro-ph.HE`: High Energy Astrophysical Phenomena
- `astro-ph.IM`: Instrumentation and Methods

### Physics (other)

- `physics.comp-ph`: Computational Physics
- `physics.data-an`: Data Analysis, Statistics and Probability
- `physics.optics`: Optics
- `physics.plasm-ph`: Plasma Physics
- `hep-th`: High-Energy Physics, Theory
- `hep-ph`: High-Energy Physics, Phenomenology
- `hep-ex`: High-Energy Physics, Experiment

### Quantitative Biology (`q-bio.*`)

- `q-bio.BM`: Biomolecules
- `q-bio.GN`: Genomics
- `q-bio.NC`: Neurons and Cognition
- `q-bio.QM`: Quantitative Methods

### Economics (`econ.*`)

- `econ.EM`: Econometrics
- `econ.TH`: Theoretical Economics

::: warning Not selectable yet
The Settings category catalog does not currently expose the `econ.*` subcategories in the web UI.
:::

### Electrical Engineering (`eess.*`)

- `eess.IV`: Image and Video Processing
- `eess.SP`: Signal Processing
- `eess.SY`: Systems and Control

::: info Full taxonomy
The complete archive list (including `cond-mat.*`, `gr-qc`, and `quant-ph`) is documented at [arxiv.org/category_taxonomy](https://arxiv.org/category_taxonomy).
:::

## How cross-listings work

Authors routinely cross-list papers across multiple subcategories; for example, a statistical machine-learning paper filed with primary category `cs.LG` is often cross-listed in `stat.ML` and `cs.AI`, so it will be harvested whether you select `cs.LG` alone or `cs.LG` alongside `stat.ML`.

Stage 1 deduplicates papers by `arxivId` across all selected subcategories so a cross-listed paper is processed and billed only once per run, while retaining its primary category metadata. Because the Stage 2 quick filter and your research profile screen out unrelated topics cheaply, including an adjacent subcategory where relevant work occasionally appears without cross-listing is almost always preferable to omitting it.

## Selection patterns

Category configurations fall along a spectrum from narrow subfield focus to exploratory cross-disciplinary sets and comprehensive domain coverage.

### Narrow and focused

Selecting two or three core subcategories suits a focused research agenda with limited daily reading time. For example, a researcher studying deep learning for galaxy evolution might select:

```
cs.LG
astro-ph.GA
astro-ph.CO
```

This configuration typically yields 5 to 15 papers per day with high signal-to-noise, though methodological papers filed solely in `stat.ML` or `astro-ph.IM` without cross-listing into those three subcategories will not be fetched unless those subcategories are added.

### Broad and exploratory

Selecting four to seven subcategories spanning both methodology and application domains suits interdisciplinary research. For example, a researcher following Bayesian methodology across the physical and life sciences might select:

```
stat.ME
stat.ML
astro-ph.IM
physics.data-an
q-bio.QM
```

This configuration typically yields 20 to 50 papers per day, relying on the Stage 2 quick filter to isolate transferable methods across domains.

### Domain-comprehensive

Selecting every subcategory in a discipline alongside one or two methodological archives suits researchers who want complete visibility across their home field. For example, full astrophysics coverage paired with computational and statistical methods includes:

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

This configuration typically yields 30 to 80 papers per day and pairs well with explicit profile exclusions and a calibrated **Papers to Analyze** cap (see [Tuning the pipeline](/using/tuning-the-pipeline)).

## Categories and profile work together

Category selection defines the outer funnel at Stage 1, while your research profile defines what scores high in Stages 2 through 5:

- **Broad categories with a narrow profile**: Casts a wide net across multiple subcategories at fetch time and uses a tightly scoped profile to filter aggressively in Stage 2. This pairing captures cross-disciplinary hits without flooding the final briefing:

```
Categories: cs.AI, cs.LG, cs.CV, cs.CL
Profile: heavily focused on "Bayesian deep learning"
```

- **Narrow categories with a broad profile**: Restricts the initial fetch to one or two subcategories and uses a permissive profile to survey major developments across that community:

```
Categories: cs.LG, stat.ML
Profile: "Any machine learning advance"
```

The first pairing processes more abstracts in Stage 2 in exchange for broader cross-field discovery, whereas the second pairing minimizes Stage 2 volume when your work lives cleanly inside a small set of subcategories.

## Common starting configurations

The following category combinations provide calibrated starting points across four research areas; adjust them after observing the volume of your first few runs.

### Machine learning researcher

```
Core: cs.LG, cs.AI, stat.ML
Optional: cs.CV, cs.CL
```

This selection typically harvests 20 to 40 papers per day.

### Computational astrophysicist

```
Core: astro-ph.CO, astro-ph.GA, astro-ph.IM
Optional: physics.comp-ph, physics.data-an, stat.AP
```

This selection typically harvests 15 to 35 papers per day.

### Applied statistician

```
Core: stat.ME, stat.AP, stat.ML
Optional: cs.LG, stat.CO
```

This selection typically harvests 10 to 25 papers per day.

### Theoretical CS

```
Core: cs.CC, cs.DS, cs.LO
Optional: math.CO, cs.CR
```

This selection typically harvests 5 to 15 papers per day.

## Fetch behaviour and rate limits

To comply with arXiv's rate-limiting guidelines, Aparture spaces consecutive metadata requests 3 to 5 seconds apart. On the primary OAI-PMH path, Aparture issues one request per top-level archive prefix (`cs`, `stat`, `physics`, `astro-ph`, and so on) and pages through the archive response, so selecting ten `cs.*` subcategories requires the same number of OAI-PMH requests as selecting one. When the Atom fallback path executes, Aparture queries one subcategory per request with a 300-paper per-request cap, which can clip the tail of an exceptionally dense multi-day window in high-volume categories (see [arXiv ingestion](/concepts/arxiv-ingestion)).

Approximate Stage 1 harvest times scale with the number of distinct archives and subcategories:

| Categories | Fetch time (approx.) |
| ---------- | -------------------- |
| 1–3        | ~1 minute            |
| 5–10       | ~2–3 minutes         |
| 20+        | ~5–10 minutes        |

Because Stage 4 PDF analysis and Stage 5 synthesis dominate total run duration, adding subcategories within an already-queried top-level OAI-PMH archive adds negligible time to a run.

## Taxonomy changes

arXiv occasionally expands or reorganizes its category taxonomy, including adding the `econ.*` archive in 2016, reorganizing several `cs.*` subcategories in 2017, and introducing the `eess.*` (Electrical Engineering and Systems Science) archive in 2020. You can add newly relevant subcategories in Settings at any time.

## Next

Continue to [The pipeline →](/concepts/pipeline) to trace how fetched papers move through filtering, scoring, PDF reading, and synthesis.

Related guides:

- [**Model selection**](/concepts/model-selection): Choose a `filterModel` and concurrency level matched to your daily category volume.
- [**Tuning the pipeline**](/using/tuning-the-pipeline): Adjust batch sizes, candidate caps, and deduplication settings for high-volume category sets.
- [**Your first briefing**](/using/first-briefing): End-to-end walkthrough of your first pipeline run.
