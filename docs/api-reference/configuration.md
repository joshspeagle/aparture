# Configuration Reference

Complete reference for Aparture configuration options.

## Configuration Location

Configuration is stored in browser `localStorage` when using the web interface or CLI automation.

**Storage key:** `arxiv-analyzer-config`

**Location:**

- **Web Interface:** Browser localStorage (persists across sessions)
- **CLI Automation:** Playwright browser profile in `temp/playwright-profile/`

## Configuration Structure

The configuration object contains all analysis settings:

```json
{
  "selectedCategories": ["cs.LG", "cs.AI", "stat.ML"],
  "researchCriteria": "I am interested in...",
  "quickFilterEnabled": true,
  "quickFilterModel": "claude-haiku-3.5",
  "quickFilterThreshold": "maybe",
  "abstractScoringModel": "claude-sonnet-4.5",
  "scoringBatchSize": 10,
  "postProcessingEnabled": false,
  "postProcessingModel": "claude-sonnet-4.5",
  "minScoreThreshold": 5.0,
  "pdfAnalysisModel": "claude-opus-4.1",
  "maxPapersForPdfAnalysis": 20,
  "generateNotebookLM": true,
  "notebookLMDuration": 15
}
```

## Configuration Options

### selectedCategories

**Type:** `string[]`

**Description:** arXiv categories to monitor

**Example:**

```json
["cs.LG", "cs.AI", "stat.ML", "astro-ph.CO"]
```

**Valid values:** Any arXiv category code (see [arXiv Categories](/concepts/arxiv-categories))

**Default:** `[]` (empty, must be set)

::: warning At least one category required
Analysis will fail without category selection
:::

---

### researchCriteria

**Type:** `string`

**Description:** Natural language description of research interests, used to score paper relevance

**Example:**

```
I am interested in:
- Deep learning applications in astrophysics
- Bayesian inference methods for time-series data
- Novel neural network architectures
- Interpretable machine learning
```

**Recommended length:** 50-200 words

**Tips:**

- Be specific about techniques and domains
- Mention both broad interests and specific topics
- Include methodology preferences
- Update based on analysis results

**Default:**

```
I am interested in papers that advance the state of the art
in my research areas through novel methodologies, significant
empirical results, or important theoretical contributions.
```

---

### quickFilterEnabled

**Type:** `boolean`

**Description:** Enable Stage 1 quick filtering for fast YES/NO/MAYBE classification

**Values:**

- `true` - Run quick filter before abstract scoring
- `false` - Skip quick filter, score all papers

**Cost impact:** Can reduce costs by 40-60% by filtering out irrelevant papers

**Time impact:** Adds 2-5 minutes to analysis

**Recommended:** `true` for broad categories or high volume (>30 papers/day)

**Default:** `true`

---

### quickFilterModel

**Type:** `string`

**Description:** AI model to use for quick filtering

**Valid values:**

- `"claude-haiku-3.5"` - Recommended
- `"claude-sonnet-4.5"`
- `"claude-opus-4.1"`
- `"gpt-5-nano"`
- `"gpt-5-mini"`
- `"gpt-5"`
- `"gemini-2.5-flash-lite"` - Cheapest
- `"gemini-2.5-flash"`
- `"gemini-2.5-pro"`

**Recommended:** `"claude-haiku-3.5"` (best speed/cost balance)

**Default:** `"claude-haiku-3.5"`

---

### quickFilterThreshold

**Type:** `string`

**Description:** Minimum filter result to proceed to scoring

**Valid values:**

- `"maybe"` - Include MAYBE and YES papers
- `"yes"` - Include only YES papers (very restrictive)

**Impact:**

- `"maybe"` - Balanced, catches edge cases (recommended)
- `"yes"` - Aggressive filtering, may miss relevant papers

**Recommended:** `"maybe"`

**Default:** `"maybe"`

---

### abstractScoringModel

**Type:** `string`

**Description:** AI model for abstract scoring (Stage 2)

**Valid values:** Same as `quickFilterModel`

**Recommended:**

- Quality-focused: `"claude-opus-4.1"` or `"gpt-5"`
- Balanced: `"claude-sonnet-4.5"` (recommended)
- Budget: `"gemini-2.5-flash"`

**Default:** `"claude-sonnet-4.5"`

---

### scoringBatchSize

**Type:** `number`

**Description:** Number of papers to score per API request

**Valid range:** 1-50

**Recommended:** 10-20

**Trade-offs:**

- **Higher (20-50):**
  - Fewer API calls
  - Lower total cost
  - Longer individual requests
  - Less granular progress updates
- **Lower (1-10):**
  - More API calls
  - Better parallelization
  - Faster feedback
  - More consistent scoring

**Default:** `10`

---

### postProcessingEnabled

**Type:** `boolean`

**Description:** Enable post-processing stage to re-score papers for consistency

**Values:**

- `true` - Run comparative re-scoring
- `false` - Skip post-processing

**When to enable:**

- Large batch sizes (>20)
- Score inconsistencies observed
- High-stakes filtering decisions
- Budget allows (~$0.50-1.00 extra)

**Cost impact:** Adds ~30-50% to scoring cost

**Time impact:** Adds 5-15 minutes

**Default:** `false`

---

### postProcessingModel

**Type:** `string`

**Description:** AI model for post-processing

**Valid values:** Same as `quickFilterModel`

**Recommended:** Same or better than `abstractScoringModel`

**Default:** `"claude-sonnet-4.5"`

---

### minScoreThreshold

**Type:** `number`

**Description:** Minimum abstract score (0-10) required for PDF analysis

**Valid range:** 0-10

**Recommended:**

- Strict: 7.0 (only high-relevance papers)
- Balanced: 5.0 (moderate-relevance and above)
- Exploratory: 3.0 (most papers)

**Impact:**

- Higher threshold = fewer PDFs analyzed = lower cost
- Lower threshold = more PDFs analyzed = more discoveries

**Default:** `5.0`

---

### pdfAnalysisModel

**Type:** `string`

**Description:** AI model for PDF analysis (Stage 3)

**Valid values:** Same as `quickFilterModel`

**Recommended:**

- Best quality: `"claude-opus-4.1"` (excellent vision)
- Balanced: `"claude-sonnet-4.5"` or `"gpt-5"`
- Budget: `"gpt-5-mini"`

**Vision capability important:** Papers with figures, equations, diagrams

**Default:** `"claude-opus-4.1"`

---

### maxPapersForPdfAnalysis

**Type:** `number`

**Description:** Maximum number of papers to analyze with full PDF

**Valid range:** 0-100

**Recommended:**

- Daily use: 10-30
- Weekly use: 50-100
- Cost-limited: 5-10

**Cost impact:**

- Each PDF costs $0.10-0.30 depending on model
- 20 PDFs ≈ $2-6 per run

**Default:** `20`

---

### generateNotebookLM

**Type:** `boolean`

**Description:** Generate NotebookLM-optimized document for podcast creation

**Values:**

- `true` - Create podcast-ready document
- `false` - Skip NotebookLM generation

**Cost impact:** ~$0.20-0.50 per document (uses Claude Opus 4.1)

**Time impact:** ~1-3 minutes

**Default:** `true`

---

### notebookLMDuration

**Type:** `number`

**Description:** Target podcast duration in minutes

**Valid values:** `5`, `10`, `15`, `20`, `25`, `30`

**Impact:**

- Shorter (5-10): Quick highlights only
- Medium (15-20): Balanced overview (recommended)
- Longer (25-30): Comprehensive deep dive

**Note:** Actual podcast duration may vary by ±2-3 minutes

**Default:** `15`

---

## Configuration Presets

### Budget Preset

```json
{
  "quickFilterEnabled": true,
  "quickFilterModel": "claude-haiku-3.5",
  "abstractScoringModel": "gemini-flash",
  "pdfAnalysisModel": "claude-sonnet-4.5",
  "maxPapersForPdfAnalysis": 10,
  "scoringBatchSize": 20,
  "postProcessingEnabled": false,
  "minScoreThreshold": 6.0,
  "generateNotebookLM": true,
  "notebookLMDuration": 10
}
```

**Daily cost:** ~$2/day (30 papers)

---

### Balanced Preset (Recommended)

```json
{
  "quickFilterEnabled": true,
  "quickFilterModel": "claude-haiku-3.5",
  "abstractScoringModel": "claude-sonnet-4.5",
  "pdfAnalysisModel": "claude-opus-4.1",
  "maxPapersForPdfAnalysis": 20,
  "scoringBatchSize": 10,
  "postProcessingEnabled": false,
  "minScoreThreshold": 5.0,
  "generateNotebookLM": true,
  "notebookLMDuration": 15
}
```

**Daily cost:** ~$4/day (30 papers)

---

### Premium Preset

```json
{
  "quickFilterEnabled": true,
  "quickFilterModel": "claude-sonnet-4.5",
  "abstractScoringModel": "claude-opus-4.1",
  "pdfAnalysisModel": "claude-opus-4.1",
  "maxPapersForPdfAnalysis": 30,
  "scoringBatchSize": 5,
  "postProcessingEnabled": true,
  "postProcessingModel": "claude-opus-4.1",
  "minScoreThreshold": 4.0,
  "generateNotebookLM": true,
  "notebookLMDuration": 20
}
```

**Daily cost:** ~$7/day (30 papers)

---

### Speed Preset

```json
{
  "quickFilterEnabled": true,
  "quickFilterModel": "gemini-flash-lite",
  "abstractScoringModel": "gemini-flash",
  "pdfAnalysisModel": "gpt-5-mini",
  "maxPapersForPdfAnalysis": 15,
  "scoringBatchSize": 20,
  "postProcessingEnabled": false,
  "minScoreThreshold": 5.0,
  "generateNotebookLM": true,
  "notebookLMDuration": 10
}
```

**Analysis time:** ~50% faster than balanced

---

## Accessing Configuration

### Web Interface

**View current config:**

1. Open browser DevTools (F12)
2. Go to "Application" or "Storage" tab
3. Expand "Local Storage"
4. Find `arxiv-analyzer-config`

**Export config:**

```javascript
// In browser console
const config = JSON.parse(localStorage.getItem('arxiv-analyzer-config'));
console.log(JSON.stringify(config, null, 2));
```

**Import config:**

```javascript
// In browser console
const config = {
  /* paste config here */
};
localStorage.setItem('arxiv-analyzer-config', JSON.stringify(config));
location.reload();
```

### CLI Automation

**View config:**

```bash
# Linux/Mac
cat temp/playwright-profile/Default/Local\ Storage/leveldb/*.log

# Windows
type temp\playwright-profile\Default\Local Storage\leveldb\*.log
```

**Reset config:**

```bash
rm -rf temp/playwright-profile
npm run setup
```

## Configuration Validation

Aparture validates configuration on startup:

**Required fields:**

- `selectedCategories` (non-empty)
- `researchCriteria` (non-empty)
- All model selections (must be valid model IDs)

**Automatic fixes:**

- Invalid models → Reset to defaults
- Out-of-range numbers → Clamp to valid range
- Missing optional fields → Use defaults

**Validation errors:**

- Missing categories → Prompts user to select
- Invalid JSON → Resets to defaults
- Missing research criteria → Uses default template

## Next Steps

- [Environment variables →](/api-reference/environment)
- [CLI commands →](/api-reference/commands)
- [Model selection guide →](/concepts/model-selection)
