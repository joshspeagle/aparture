# Multi-Stage Analysis

Understanding Aparture's multi-stage pipeline architecture for efficient paper discovery.

## Overview

Aparture uses a progressive filtering approach with multiple stages, each adding more detail while processing fewer papers. This design:

- **Reduces costs** - Expensive analysis only on relevant papers
- **Improves quality** - Right model for each task
- **Saves time** - Parallel processing where possible
- **Maintains accuracy** - Progressive refinement

## Pipeline Stages

### Stage 0: Paper Fetching

**Purpose:** Retrieve paper metadata from arXiv

**Process:**

1. Query arXiv API for selected categories
2. Filter by date (typically last 24 hours)
3. Download metadata (title, authors, abstract, PDF link)
4. Deduplicate cross-listed papers

**Typical volume:** 20-100 papers depending on categories

**Duration:** 1-5 minutes

**Cost:** Free (arXiv API)

**Output:** List of papers with metadata

### Stage 1: Quick Filter (Optional)

**Purpose:** Fast YES/NO/MAYBE classification to reduce volume

**When to enable:**

- Broad category selection (>30 papers/day)
- High-volume monitoring
- Cost-sensitive workflows

**Process:**

1. Batch papers (typically 20 per request)
2. Send title + abstract to fast model
3. Get binary classification: YES, MAYBE, or NO
4. Filter out NO papers

**Typical throughput:**

- Input: 50 papers
- Output: 30 papers (20 YES, 10 MAYBE, 20 NO filtered)

**Duration:** 2-5 minutes

**Cost:** $0.05-0.15 (using Haiku or Flash-Lite)

**Models:**

- **Recommended:** Claude Haiku 3.5 (fast, accurate)
- **Alternative:** Gemini Flash-Lite (cheapest)
- **Avoid:** Opus/GPT-5 Standard (overkill)

**Prompt structure:**

```
Given this research criteria: [criteria]

For each paper, respond with:
- YES if highly relevant
- MAYBE if potentially relevant
- NO if not relevant

Papers:
1. [title + abstract]
2. [title + abstract]
...
```

**Cost savings:** 40-60% reduction in scoring costs by filtering out irrelevant papers early.

::: tip When to skip Quick Filter
If you have narrow, focused categories (<20 papers/day), skip this stage and go straight to abstract scoring.
:::

### Stage 2: Abstract Scoring

**Purpose:** Detailed relevance scoring (0-10 scale) with justifications

**This is the core filtering stage** - every paper gets a detailed score and explanation.

**Process:**

1. Batch papers (typically 10-20 per request)
2. Send full metadata to quality model
3. Get detailed scores (0-10) with justifications
4. Sort by score

**Typical throughput:**

- Input: 30 papers (after quick filter)
- Output: 30 scored papers (avg score: 5-7)

**Duration:** 10-30 minutes

**Cost:** $0.50-2.00 depending on model

**Models:**

- **Budget:** Gemini Flash ($0.50)
- **Recommended:** Claude Sonnet 4.5 ($1.20)
- **Premium:** Claude Opus 4.1 ($2.50)

**Prompt structure:**

```
Research criteria: [criteria]

For each paper, provide:
- Score (0-10): How relevant to the criteria
- Justification: Specific reasons for the score

Papers:
1. Title: [title]
   Authors: [authors]
   Abstract: [abstract]
```

**Output format:**

```json
{
  "papers": [
    {
      "id": "2410.12345",
      "score": 8.5,
      "justification": "Highly relevant. Addresses [specific aspect] with [novel approach]. Strong [characteristic]."
    }
  ]
}
```

**Scoring guidelines provided to model:**

- **9-10:** Must-read, directly addresses core interests
- **7-8:** Should read, strong relevance
- **5-6:** Maybe read, moderate relevance
- **3-4:** Probably skip, tangential relevance
- **0-2:** Skip, not relevant

### Stage 3: Post-Processing (Optional)

**Purpose:** Re-score papers for consistency using comparative analysis

**When to enable:**

- Large batch sizes (>20 papers per request)
- Score inconsistencies observed
- High-stakes filtering decisions

**Process:**

1. Group all scored papers
2. Send to model with all previous scores
3. Model adjusts scores for consistency
4. Papers re-ranked

**Typical adjustments:**

- ±0.5 points on average
- Brings outliers in line
- Maintains relative ordering mostly

**Duration:** 5-15 minutes

**Cost:** +30-50% of abstract scoring cost

**Models:** Same or better than abstract scoring model

**When it helps:**

- Different batches get different score distributions
- Early batches scored differently than late batches
- Model is sensitive to batch composition

**When to skip:**

- Small batch sizes (<10 papers per request)
- Consistent scoring observed
- Budget-constrained

::: info Comparative scoring
Post-processing asks the model: "Given all these papers together, are the scores consistent? Should any be adjusted?"
:::

### Stage 4: PDF Analysis

**Purpose:** Deep analysis of full paper content for top papers

**This stage adds significant value** - full paper understanding with figures, equations, and details.

**Process:**

1. Select top N papers (typically 10-30) above threshold
2. Download PDFs from arXiv (with fallback handling)
3. Send PDF + metadata to vision-capable model
4. Get comprehensive analysis

**Typical throughput:**

- Input: Top 20 papers (score ≥5.0)
- Output: 20 detailed analyses
- Rate: 2-second delay between PDFs

**Duration:** 15-45 minutes

**Cost:** $2-6 depending on model and paper count

**Models:**

- **Budget:** Claude Sonnet 4.5 ($2.50)
- **Recommended:** Claude Opus 4.1 ($4.00)
- **Alternative:** GPT-5 Standard ($3.50)

**Prompt structure:**

```
Paper: [title]
Authors: [authors]
Abstract: [abstract]
Score: [score]
Relevance: [justification]

Attached: Full PDF

Provide comprehensive analysis:
- Key contributions
- Methodology
- Results and findings
- Limitations
- Future directions
- How it relates to: [research criteria]
```

**PDF handling:**

1. **Direct fetch attempt** - Standard HTTP request
2. **reCAPTCHA detection** - Check for HTML response
3. **Playwright fallback** - Use browser with session if blocked
4. **Rate limiting** - 2-second delay between downloads

**Vision capability importance:**

- **Critical for:** ML papers (architecture diagrams), physics (plots), math (equations)
- **Less critical for:** Theory papers, reviews, position papers

**Output includes:**

- Summary (2-3 paragraphs)
- Key contributions (bullet list)
- Methodology details
- Results and findings
- Limitations and caveats
- Future directions

### Stage 5: Report Generation

**Purpose:** Compile all results into structured markdown report

**Process:**

1. Gather all paper data
2. Sort by score (descending)
3. Format markdown with sections
4. Add configuration and cost summary
5. Save to reports/

**Duration:** <10 seconds

**Cost:** Free (local processing)

**Output:** `YYYY-MM-DD_arxiv_analysis_XXmin.md`

### Stage 6: NotebookLM Generation (Optional)

**Purpose:** Create podcast-optimized document

**Process:**

1. Take all analyzed papers
2. Organize thematically
3. Write conversational summaries
4. Structure for audio consumption
5. Save to reports/

**Duration:** 1-3 minutes

**Cost:** $0.20-0.50 (uses Claude Opus 4.1)

**Output:** `YYYY-MM-DD_notebooklm_XXmin.md`

## Cost Breakdown Example

**Typical daily run** (30 papers, 10 PDFs, balanced configuration):

| Stage            | Model      | Cost      | % of Total |
| ---------------- | ---------- | --------- | ---------- |
| Fetching         | arXiv API  | $0.00     | 0%         |
| Quick Filter     | Haiku 3.5  | $0.05     | 1%         |
| Abstract Scoring | Sonnet 4.5 | $0.60     | 15%        |
| Post-Processing  | Skip       | $0.00     | 0%         |
| PDF Analysis     | Opus 4.1   | $3.00     | 76%        |
| NotebookLM       | Opus 4.1   | $0.30     | 8%         |
| **Total**        |            | **$3.95** | **100%**   |

**Key insight:** PDF analysis dominates cost, so limiting the number of PDFs analyzed is the most effective cost control.

## Optimization Strategies

### Cost Optimization

**Reduce PDF Analysis:**

- Increase score threshold (5.0 → 6.0)
- Reduce max papers (20 → 10)
- Saves: ~50% of total cost

**Use Cheaper Models:**

- Scoring: Opus → Sonnet → Flash
- Quick Filter: Sonnet → Haiku → Flash-Lite
- Saves: ~30-40% of total cost

**Enable Quick Filter:**

- Pre-screens papers
- Reduces scoring volume by 40-60%
- Saves: ~40% of scoring cost

**Larger Batch Sizes:**

- More papers per API call
- Reduces overhead
- Saves: ~10-15% of API costs

### Quality Optimization

**Better Models:**

- Use Opus for all stages
- More consistent, detailed
- Cost: +50-70%

**Enable Post-Processing:**

- Improves score consistency
- Catches edge cases
- Cost: +30-50% scoring

**Smaller Batch Sizes:**

- More focused attention per paper
- Better score calibration
- Cost: +10-15% (more API calls)

**Lower Score Threshold:**

- Analyze more papers with PDFs
- Don't miss borderline cases
- Cost: +50-100% PDF analysis

### Speed Optimization

**Faster Models:**

- Use Flash/Haiku/Nano everywhere
- 2-3x faster processing
- Quality: -20-30%

**Larger Batches:**

- Fewer serial API calls
- Better parallelization
- Quality: slightly worse

**Skip Optional Stages:**

- Disable Quick Filter (if low volume)
- Disable Post-Processing
- Skip NotebookLM
- Time: -30-40%

## Monitoring and Debugging

### Progress Tracking

Watch for:

- Stage transitions
- Paper counts at each stage
- Processing speed
- API errors

### Quality Indicators

**Good signs:**

- Reasonable score distribution (bell curve)
- Detailed justifications
- PDF analyses with specifics
- Few papers at extremes (0-2, 9-10)

**Warning signs:**

- All scores 7-9 (inflation)
- Generic justifications
- PDF download failures
- Inconsistent scoring across batches

### Common Issues

**High NO rate in Quick Filter:**

- Research criteria too narrow
- Wrong categories selected
- Model misunderstanding criteria

**Low average scores:**

- Research criteria too specific
- Papers genuinely not relevant
- Consider broader categories

**PDF download failures:**

- arXiv rate limiting
- reCAPTCHA blocks
- Network issues
- Playwright fallback should handle most cases

## Advanced Techniques

### Custom Scoring Weights

Weight different aspects:

```
Relevance score breakdown:
- Technical approach: 40%
- Domain fit: 30%
- Novelty: 20%
- Practical applicability: 10%
```

### Multi-Pass Scoring

Run abstract scoring twice:

1. First pass: Initial scores
2. Second pass: Comparative adjustment
3. Combine: Weighted average

### Ensemble Scoring

Use multiple models:

1. Score with Sonnet
2. Score with GPT-5
3. Score with Gemini
4. Average or vote

## Next Steps

- [Choose the right models →](/concepts/model-selection)
- [Select categories →](/concepts/arxiv-categories)
- [Set up automation →](/user-guide/cli-automation)
