# Web Interface

Learn how to use the Aparture web interface for interactive paper analysis.

## Overview

The web interface provides a visual, step-by-step workflow for configuring and running paper analysis. It's ideal for:

- First-time setup and exploration
- Testing different configurations
- One-off analyses
- Visual progress monitoring

For automated daily runs, see [CLI Automation](/user-guide/cli-automation).

## Authentication

When you first visit the application, you'll be prompted for a password.

```bash
ACCESS_PASSWORD=your-secure-password-here
```

This password is set in your `.env.local` file and protects access to the application and your API keys.

::: warning Never share your access password
Anyone with this password can use your API keys and run analyses at your expense.
:::

## Configuration Panel

The left sidebar contains all configuration options:

### arXiv Categories

Select which arXiv categories to monitor:

1. **Expand sections** - Click on major categories (cs, stat, astro-ph, etc.)
2. **Select subcategories** - Check individual boxes or use "Add All"
3. **Review selection** - Selected categories appear in the summary

**Popular selections:**

- **Machine Learning**: cs.LG, cs.AI, stat.ML
- **Astrophysics**: astro-ph.CO, astro-ph.GA, astro-ph.SR
- **Statistics**: stat.ML, stat.ME, stat.AP

### Research Criteria

Define your research interests in natural language. This prompt is used to score paper relevance.

**Example:**

```
I am interested in:
- Deep learning applications in astrophysics
- Bayesian inference methods for time-series data
- Novel neural network architectures
- Interpretable machine learning
```

**Tips:**

- Be specific about techniques and applications
- Mention domains and methodologies
- Include both broad interests and specific topics
- Keep it under 200 words for best results

### Model Selection

Choose AI models for each processing stage:

**Quick Filter** (Stage 1)

- **Recommended**: Claude Haiku 3.5 (fast, cheap)
- Alternative: Gemini Flash-Lite (similar performance)

**Abstract Scoring** (Stage 2)

- **Recommended**: Claude Sonnet 4.5 (balanced)
- Alternative: GPT-5 Standard, Gemini Pro

**PDF Analysis** (Stage 3)

- **Recommended**: Claude Opus 4.1 (best quality)
- Alternative: GPT-5 Standard (good, but less vision capability)

**NotebookLM Document**

- **Fixed**: Claude Opus 4.1 (required for quality)

See [Model Selection](/concepts/model-selection) for detailed comparisons.

### Batch & Threshold Settings

**Batch Size**

- Controls how many papers are processed per API request
- **Recommended**: 10-20 for balance
- Higher = fewer API calls but longer individual requests
- Lower = more API calls but better parallelization

**Score Thresholds**

- **Quick Filter**: MAYBE/YES threshold (if enabled)
- **Abstract Score**: Minimum score for PDF analysis (default: 5.0)
- **Post-processing**: Minimum adjusted score (if enabled)

**PDF Analysis Limit**

- Maximum number of papers to analyze deeply
- **Recommended**: 20-30 for daily runs
- Higher = more comprehensive but longer runtime

### Optional Stages

**Quick Filter (Stage 1)**

- Fast YES/NO/MAYBE filtering before detailed scoring
- Reduces API costs by 50-70% on irrelevant papers
- **Enable if**: You have broad categories or high volume

**Post-Processing**

- Re-scores papers using comparative analysis
- Improves consistency across batches
- **Enable if**: You notice score inconsistencies

**NotebookLM Document**

- Generates podcast-optimized document
- Required for podcast generation
- **Duration**: 5-30 minutes (configure in settings)

## Running Analysis

### Start Analysis

1. **Review configuration** - Check all settings are correct
2. **Click "Start Analysis"** - Workflow begins
3. **Monitor progress** - Watch real-time updates

### Progress Stages

**Fetching Papers**

- Downloads metadata from arXiv
- Duration: 1-5 minutes
- Shows: Categories, date range, paper count

**Quick Filter** (if enabled)

- Fast YES/NO/MAYBE classification
- Duration: 2-5 minutes
- Shows: YES/MAYBE/NO counts

**Scoring Abstracts**

- Detailed relevance scoring (0-10 scale)
- Duration: 10-30 minutes
- Shows: Progress, score distribution

**Post-Processing** (if enabled)

- Comparative re-scoring
- Duration: 5-15 minutes
- Shows: Score adjustments

**Analyzing PDFs**

- Deep analysis of top papers
- Duration: 15-45 minutes
- Shows: Current paper, progress

**Generating NotebookLM Document** (if enabled)

- Creates podcast-optimized summary
- Duration: 1-3 minutes
- Shows: Processing status

### Monitoring

During analysis, you'll see:

- **Current stage** - Which processing step is active
- **Progress bars** - Completion percentage
- **Paper counts** - Papers processed/remaining
- **Estimated time** - Based on current speed
- **Live results** - Top papers updating in real-time

::: info Can I close my browser?
No, the web interface requires an active connection. For unattended runs, use [CLI automation](/user-guide/cli-automation).
:::

## Results Panel

As analysis progresses, results appear in the main panel:

### Paper Cards

Each paper shows:

- **Title** - Linked to arXiv abstract
- **Authors** - Primary authors listed
- **Score** - Relevance score (0-10)
- **Abstract** - With relevance justification
- **PDF Analysis** - Deep summary (if analyzed)

**Card colors:**

- **Green border** - High relevance (8-10)
- **Yellow border** - Moderate relevance (5-7)
- **No border** - Lower relevance (<5)

### Sorting & Filtering

- **Sort by score** - Highest relevance first (default)
- **Sort by date** - Newest papers first
- **Filter by stage** - Show only PDF-analyzed papers
- **Search** - Find papers by keyword

## Downloading Reports

When analysis completes:

### Analysis Report

Click **"Download Report"** to get a comprehensive markdown file:

**Includes:**

- Executive summary
- Top papers with scores and justifications
- Full PDF analyses
- Configuration details
- Timing and cost information

**Filename:** `YYYY-MM-DD_arxiv_analysis_XXmin.md`

### NotebookLM Document

If generated, click **"Download NotebookLM Document"**:

**Includes:**

- Structured summaries optimized for audio
- Paper highlights and connections
- Thematic organization
- Ready for podcast generation

**Filename:** `YYYY-MM-DD_notebooklm_XXmin.md`

::: tip Want podcasts?
Upload the NotebookLM document to [notebooklm.google.com](https://notebooklm.google.com) and click "Generate" in the Audio Overview section. Or use [CLI automation](/user-guide/cli-automation) to automate this.
:::

## Keyboard Shortcuts

- **Ctrl/Cmd + K** - Focus search
- **Ctrl/Cmd + D** - Download report
- **Esc** - Close modals

## Troubleshooting

### Analysis Won't Start

**Check:**

- At least one category selected
- All required environment variables set
- Browser console for errors (F12)

### Progress Stuck

**Try:**

- Refresh the page (state is preserved on server)
- Check browser console for connection errors
- Verify API keys are valid

### Papers Not Loading

**Causes:**

- No papers published today in selected categories
- arXiv API temporarily unavailable
- Network connectivity issues

**Solution:**

- Try different categories
- Wait a few minutes and retry
- Check arXiv status page

### High API Costs

**Reduce costs:**

- Enable Quick Filter to pre-screen papers
- Lower batch sizes for better control
- Use cheaper models (Haiku instead of Opus)
- Reduce PDF analysis limit

## Next Steps

- [Learn about CLI automation →](/user-guide/cli-automation)
- [Understand multi-stage analysis →](/concepts/multi-stage-analysis)
- [Test your setup →](/user-guide/testing)
