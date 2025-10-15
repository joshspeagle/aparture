# Quick Start

Get up and running with Aparture in 5 minutes.

## Overview

This guide walks you through your first paper analysis using the web interface. You'll:

1. Select arXiv categories
2. Define your research interests
3. Configure analysis settings
4. Run the analysis
5. Review results

**Time required:** ~5-10 minutes for configuration, 20-45 minutes for analysis

## Prerequisites

Before starting, ensure you have:

- ✅ [Installed Aparture](/getting-started/installation)
- ✅ [Configured environment variables](/getting-started/setup)
- ✅ At least one API key (Anthropic, OpenAI, or Google)
- ✅ Development server running (`npm run dev`)

## Step 1: Access the Application

1. Start the development server:

```bash
npm run dev
```

2. Open your browser to [http://localhost:3000](http://localhost:3000)

3. Enter your `ACCESS_PASSWORD` from `.env.local`

You should now see the main Aparture interface.

## Step 2: Select Categories

Choose which arXiv categories to monitor.

**For this quick start, select:**

- `cs.LG` - Machine Learning
- `cs.AI` - Artificial Intelligence

**How to select:**

1. Click **"Computer Science (cs)"** to expand
2. Check boxes for `cs.LG` and `cs.AI`
3. See the summary update: "2 categories selected"

::: tip Starting Small
Begin with 2-3 categories for your first run. You can expand later.
:::

## Step 3: Define Research Criteria

Enter your research interests in natural language.

**Example criteria:**

```
I am interested in:
- Deep learning methods for computer vision
- Novel neural network architectures
- Transfer learning and fine-tuning techniques
- Practical applications with code implementations
```

**Tips:**

- Be specific about techniques you care about
- Mention both broad areas and specific interests
- Include domain applications if relevant
- Keep it under 200 words

## Step 4: Configure Analysis Settings

### Quick Filter (Recommended)

Enable quick filtering for faster, cheaper analysis:

- **Quick Filter**: ✅ Enable
- **Model**: Claude Haiku 3.5 (fast and cheap)
- **Threshold**: MAYBE (balanced)

### Abstract Scoring

Configure detailed scoring:

- **Model**: Claude Sonnet 4.5 (balanced quality)
- **Batch Size**: 10 papers per request
- **Min Score Threshold**: 5.0 (moderate relevance)

### PDF Analysis

Set how many papers to analyze deeply:

- **Model**: Claude Opus 4.1 (best quality)
- **Max Papers**: 10 (good for first run)

### Optional: NotebookLM

Generate a podcast-ready document:

- **Generate NotebookLM**: ✅ Enable
- **Duration**: 15 minutes

::: warning API Costs
This configuration costs approximately $1-2 for ~30 papers (Quick Filter + Sonnet scoring + 10 Opus PDF analyses). Adjust settings if cost is a concern.
:::

## Step 5: Start Analysis

1. Click **"Start Analysis"** button
2. Watch the progress indicators
3. Wait for completion (~20-45 minutes)

**Progress stages you'll see:**

1. 🔍 Fetching papers (~1 min)
2. ⚡ Quick filter (~2 min)
3. 📊 Scoring abstracts (~10-20 min)
4. 📄 Analyzing PDFs (~10-20 min)
5. 📝 Generating NotebookLM document (~1 min)

## Step 6: Review Results

Once complete, you'll see:

### Results Panel

Papers sorted by relevance score (0-10):

**High relevance (8-10):**

- Green border
- Detailed justification
- Full PDF analysis

**Moderate relevance (5-7):**

- Yellow border
- Brief justification
- May have PDF analysis

**Lower relevance (<5):**

- No border
- Short justification

### What to Look For

**Score:** How relevant is this paper?

- 9-10: Must read
- 7-8: Should read
- 5-6: Maybe read
- <5: Probably skip

**Justification:** Why this score?

- Specific connections to your interests
- Key contributions mentioned
- Methodology relevance

**PDF Analysis:** Deep summary

- Main contributions
- Methodology details
- Results and findings
- Limitations
- Future directions

## Step 7: Download Reports

Get your analysis results:

### Analysis Report

1. Click **"Download Report"**
2. Saves as: `YYYY-MM-DD_arxiv_analysis_XXmin.md`
3. Contains all scores, justifications, and PDF analyses

### NotebookLM Document (if enabled)

1. Click **"Download NotebookLM Document"**
2. Saves as: `YYYY-MM-DD_notebooklm_XXmin.md`
3. Upload to [notebooklm.google.com](https://notebooklm.google.com) to generate podcast

::: tip Reading Reports
Use a Markdown viewer like VS Code, Obsidian, or Typora for best experience.
:::

## Next Steps

### Refine Your Workflow

Now that you've completed your first analysis:

1. **Adjust categories** - Add or remove based on results
2. **Refine criteria** - Update based on what was/wasn't caught
3. **Optimize costs** - Adjust batch sizes and thresholds
4. **Try different models** - Experiment with cost/quality trade-offs

### Automate Daily Runs

Set up CLI automation for unattended daily analyses:

```bash
# Configure once
npm run setup

# Run daily
npm run analyze
```

See [CLI Automation Guide →](/user-guide/cli-automation)

### Explore Advanced Features

- [Testing modes →](/user-guide/testing) - Dry run and minimal tests
- [Model selection →](/concepts/model-selection) - Choose the right models
- [NotebookLM podcasts →](/concepts/notebooklm) - Generate audio overviews

## Troubleshooting

### No Papers Found

**Possible causes:**

- No papers published today in selected categories
- Too narrow category selection
- arXiv API temporarily down

**Solutions:**

- Try different categories
- Wait until afternoon (papers published throughout the day)
- Check [arXiv status](https://status.arxiv.org)

### Analysis Stuck

**If progress stops:**

1. Check browser console (F12) for errors
2. Verify API keys are valid and have available credits
3. Check API rate limits in provider dashboards
4. Refresh the page if interface becomes unresponsive

### High Costs

**To reduce costs:**

- Enable Quick Filter (saves 40-60%)
- Use cheaper models (Haiku, Flash)
- Reduce batch sizes
- Lower PDF analysis limit
- Start with fewer categories

### Poor Relevance

**If papers aren't relevant:**

1. Make research criteria more specific
2. Add example topics or papers
3. Adjust score threshold higher
4. Enable post-processing for consistency

## Example Output

Here's what a typical first run produces:

**Papers fetched:** 47 from cs.LG and cs.AI
**After quick filter:** 30 papers (20 YES, 10 MAYBE)
**Average score:** 6.2/10
**Top score:** 9.1
**Papers with PDF analysis:** 10
**Duration:** 32 minutes
**Cost:** ~$1.80

**Top paper example:**

> **Title:** "Efficient Attention Mechanisms for Vision Transformers"
> **Score:** 9.1/10
> **Why relevant:** Novel attention mechanism directly applicable to your computer vision interests. Includes code implementation and strong empirical results on standard benchmarks.

## Tips for Success

1. **Start small** - 2-3 categories, 10 PDFs
2. **Iterate** - Refine criteria based on results
3. **Track costs** - Monitor API usage dashboards
4. **Test first** - Use dry run mode before production
5. **Read the reports** - Don't just trust scores

## Getting Help

- Check [User Guide →](/user-guide/web-interface) for detailed interface documentation
- See [Testing Guide →](/user-guide/testing) for troubleshooting test modes
- File issues on [GitHub](https://github.com/joshspeagle/aparture/issues)

Happy discovering! 🔍
