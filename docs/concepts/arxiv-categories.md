# arXiv Categories

Understanding arXiv's taxonomy and how to pick a set of categories that matches your research interests.

## What are arXiv categories?

arXiv organises papers into a hierarchical taxonomy with:

- **Major categories** — top-level domains (cs, math, physics, etc.)
- **Subcategories** — specialised topics within a domain
- **Cross-listings** — papers appearing in more than one category

Papers can belong to multiple subcategories, with one designated as primary.

## Category structure

### Computer Science (cs)

**Artificial Intelligence**

- `cs.AI` — Artificial Intelligence
- `cs.LG` — Machine Learning
- `cs.NE` — Neural and Evolutionary Computing
- `cs.CV` — Computer Vision and Pattern Recognition
- `cs.CL` — Computation and Language (NLP)

**Theory**

- `cs.CC` — Computational Complexity
- `cs.DS` — Data Structures and Algorithms
- `cs.LO` — Logic in Computer Science

**Systems**

- `cs.DC` — Distributed, Parallel, and Cluster Computing
- `cs.OS` — Operating Systems
- `cs.PL` — Programming Languages
- `cs.SE` — Software Engineering

**Other**

- `cs.CR` — Cryptography and Security
- `cs.DB` — Databases
- `cs.HC` — Human-Computer Interaction
- `cs.IR` — Information Retrieval
- `cs.RO` — Robotics

The [full list](https://arxiv.org/category_taxonomy) includes 40+ cs subcategories.

### Mathematics (math)

**Pure Mathematics**

- `math.AG` — Algebraic Geometry
- `math.NT` — Number Theory
- `math.GT` — Geometric Topology
- `math.RT` — Representation Theory

**Applied Mathematics**

- `math.NA` — Numerical Analysis
- `math.OC` — Optimization and Control
- `math.PR` — Probability
- `math.ST` — Statistics Theory

**Interdisciplinary**

- `math.CO` — Combinatorics
- `math.DS` — Dynamical Systems
- `math.MP` — Mathematical Physics

### Statistics (stat)

- `stat.ML` — Machine Learning
- `stat.ME` — Methodology
- `stat.AP` — Applications
- `stat.CO` — Computation
- `stat.TH` — Theory

### Physics (physics, astro-ph, etc.)

**Astrophysics (astro-ph)**

- `astro-ph.CO` — Cosmology and Nongalactic Astrophysics
- `astro-ph.GA` — Astrophysics of Galaxies
- `astro-ph.SR` — Solar and Stellar Astrophysics
- `astro-ph.EP` — Earth and Planetary Astrophysics
- `astro-ph.HE` — High Energy Astrophysical Phenomena
- `astro-ph.IM` — Instrumentation and Methods

**General Physics (physics)**

- `physics.comp-ph` — Computational Physics
- `physics.data-an` — Data Analysis, Statistics and Probability
- `physics.optics` — Optics
- `physics.plasm-ph` — Plasma Physics

**High Energy Physics (hep-)**

- `hep-th` — High Energy Physics - Theory
- `hep-ph` — High Energy Physics - Phenomenology
- `hep-ex` — High Energy Physics - Experiment

### Quantitative Biology (q-bio)

- `q-bio.BM` — Biomolecules
- `q-bio.GN` — Genomics
- `q-bio.NC` — Neurons and Cognition
- `q-bio.QM` — Quantitative Methods

### Economics (econ)

- `econ.EM` — Econometrics
- `econ.TH` — Theoretical Economics

### Electrical Engineering (eess)

- `eess.IV` — Image and Video Processing
- `eess.SP` — Signal Processing
- `eess.SY` — Systems and Control

::: info Full taxonomy
See [arxiv.org/category_taxonomy](https://arxiv.org/category_taxonomy) for the complete list of 150+ categories.
:::

## Choosing categories

Three broad strategies, each with its own volume / noise / cost profile.

### Strategy 1: narrow and focused

**When to use:**

- Clear, specific research interests
- Limited time for daily reading
- You want a high signal-to-noise ratio

**Example: deep learning in astronomy**

```
Selected categories:
- cs.LG (Machine Learning)
- astro-ph.GA (Astrophysics of Galaxies)
- astro-ph.CO (Cosmology)
```

**Typical volume:** 5–15 papers/day.
**Pros:** highly relevant results.
**Cons:** you'll miss related work that doesn't cross-list into your chosen set.

### Strategy 2: broad and exploratory

**When to use:**

- Interdisciplinary research
- You want to discover new connections
- You have time to read widely

**Example: Bayesian methods across fields**

```
Selected categories:
- stat.ME (Statistics Methodology)
- stat.ML (Machine Learning)
- astro-ph.IM (Instrumentation)
- physics.data-an (Data Analysis)
- econ.EM (Econometrics)
```

**Typical volume:** 20–50 papers/day.
**Pros:** unexpected cross-field connections surface.
**Cons:** more noise, higher costs per run.

### Strategy 3: domain-focused

**When to use:**

- Deep expertise in one field
- You want comprehensive coverage
- Daily reading is a core activity

**Example: complete astrophysics coverage**

```
Selected categories:
- All astro-ph.* subcategories (6 total)
- physics.comp-ph
- stat.AP
```

**Typical volume:** 30–80 papers/day.
**Pros:** you miss nothing in your domain.
**Cons:** high volume, higher spend.

## Cross-listing considerations

Papers often appear in more than one category:

**Example paper:**

- Primary: `cs.LG`
- Cross-listed: `stat.ML`, `cs.AI`

**How Aparture handles this:**

- Fetches unique papers (no duplicates)
- Considers all selected categories
- Shows primary category in results

**Implications:**

- Selecting both `cs.LG` and `stat.ML` won't duplicate papers
- But you'll get papers where either is primary
- More categories = better coverage

## Category selection tips

### Start small

Begin with 2–3 highly relevant categories:

1. **Test with a dry run** — see typical paper volume.
2. **Run a minimal analysis** — check relevance.
3. **Add categories gradually** — expand as needed.

### Monitor volume

Track papers per category over time:

- **Low volume** (<5/day) — consider adding related categories.
- **High volume** (>50/day) — consider enabling Quick Filter.
- **Overwhelming** (>100/day) — narrow the selection or raise score thresholds.

### Check cross-listings

Some papers appear in multiple categories you care about:

**Example workflow:**

1. Run analysis with `cs.LG` only.
2. Check where the top papers are cross-listed.
3. Add those categories for better coverage.

### Pair categories with your profile

Category selection and your profile work together — the categories control what gets pulled in, and your profile controls what gets scored up.

**Broad categories, narrow profile:**

```
Categories: cs.AI, cs.LG, cs.CV, cs.CL
Profile focus: "Bayesian deep learning"
```

**Narrow categories, broad profile:**

```
Categories: cs.LG, stat.ML
Profile focus: "Any machine learning advances"
```

## Common combinations

### Machine learning researcher

```
Core:
- cs.LG (Machine Learning)
- cs.AI (Artificial Intelligence)
- stat.ML (Statistics - Machine Learning)

Optional:
- cs.CV (Computer Vision)
- cs.CL (NLP)
```

**Volume:** 20–40 papers/day.

### Computational astrophysicist

```
Core:
- astro-ph.CO (Cosmology)
- astro-ph.GA (Galaxies)
- astro-ph.IM (Instrumentation)

Optional:
- physics.comp-ph (Computational Physics)
- physics.data-an (Data Analysis)
- stat.AP (Statistics Applications)
```

**Volume:** 15–35 papers/day.

### Applied statistician

```
Core:
- stat.ME (Methodology)
- stat.AP (Applications)
- stat.ML (Machine Learning)

Optional:
- cs.LG (Machine Learning)
- econ.EM (Econometrics)
```

**Volume:** 10–25 papers/day.

### Theory-focused CS

```
Core:
- cs.CC (Computational Complexity)
- cs.DS (Data Structures & Algorithms)
- cs.LO (Logic)

Optional:
- math.CO (Combinatorics)
- cs.CR (Cryptography)
```

**Volume:** 5–15 papers/day.

## Category updates

arXiv occasionally updates its taxonomy:

**Recent changes:**

- 2020: added `eess.*` (Electrical Engineering).
- 2017: reorganised `cs.*` subcategories.
- 2016: added `econ.*` (Economics).

**Staying current:**

- Check [arXiv taxonomy](https://arxiv.org/category_taxonomy) annually.
- Watch for new subcategories in your field.
- Update Aparture configuration as needed.

::: tip New subcategory?
If you notice a new relevant subcategory, add it to your configuration and re-run historical analyses to catch papers you missed.
:::

## API considerations

### Fetching limits

arXiv's API has rate limits:

- 1 request per 3 seconds
- Maximum 1000 results per request

**How Aparture handles this:**

- Automatically respects rate limits.
- Batches requests across multiple categories.
- Paginates large result sets.

### Performance

More categories = longer fetching:

- 1–3 categories: ~1 minute.
- 5–10 categories: ~2–3 minutes.
- 20+ categories: ~5–10 minutes.

## Next steps

- [Understanding the pipeline →](/concepts/pipeline)
- [Briefing anatomy →](/concepts/briefing-anatomy)
- [Choosing the right models →](/concepts/model-selection)
- [Generate your first briefing →](/getting-started/first-briefing)
