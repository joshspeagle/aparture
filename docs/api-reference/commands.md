# CLI Commands

Complete reference for all Aparture command-line interface commands.

## Core Commands

### npm run dev

Start the Next.js development server for the web interface.

```bash
npm run dev
```

**What it does:**

- Starts development server on http://localhost:3000
- Enables hot module reloading
- Loads environment variables from `.env.local`
- Serves the Aparture web interface

**When to use:**

- Interactive web-based analysis
- Testing configuration changes
- Manual paper review
- First-time setup

**Output:**

```
▲ Next.js 14.2.31
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 1254ms
```

---

### npm run analyze

Run complete automated analysis with all features enabled.

```bash
npm run analyze
```

**What it does:**

- Complete multi-stage analysis pipeline
- Generates NotebookLM document
- Uploads to Google NotebookLM
- Generates and downloads podcast
- Saves all outputs to `reports/`

**Duration:** 40-120 minutes

**Outputs:**

- Analysis report: `YYYY-MM-DD_arxiv_analysis_XXmin.md`
- NotebookLM document: `YYYY-MM-DD_notebooklm_XXmin.md`
- Podcast audio: `YYYY-MM-DD_podcast.m4a`
- Screenshots: `reports/screenshots/`

**First run:** Requires interactive Google authentication for NotebookLM

---

### npm run analyze:report

Run analysis and generate report only (skip NotebookLM features).

```bash
npm run analyze:report
```

**What it does:**

- Complete multi-stage analysis pipeline
- Generates analysis report
- Skips NotebookLM document generation
- Skips podcast generation

**Duration:** 30-90 minutes

**Outputs:**

- Analysis report: `YYYY-MM-DD_arxiv_analysis_XXmin.md`
- Screenshots: `reports/screenshots/`

**When to use:**

- Don't need podcast output
- Want faster completion
- Testing analysis configuration

---

### npm run analyze:document

Run analysis and generate NotebookLM document (skip podcast).

```bash
npm run analyze:document
```

**What it does:**

- Complete multi-stage analysis pipeline
- Generates analysis report
- Generates NotebookLM document
- Skips podcast generation

**Duration:** 30-90 minutes

**Outputs:**

- Analysis report: `YYYY-MM-DD_arxiv_analysis_XXmin.md`
- NotebookLM document: `YYYY-MM-DD_notebooklm_XXmin.md`
- Screenshots: `reports/screenshots/`

**When to use:**

- Want NotebookLM document for manual podcast generation
- Skip automated podcast to save time
- Generate document for other uses

---

### npm run analyze:podcast

Generate podcast from existing files (skip analysis).

```bash
npm run analyze:podcast
```

**What it does:**

- Finds most recent analysis report
- Finds most recent NotebookLM document
- Verifies files are from same date
- Uploads to Google NotebookLM
- Generates and downloads podcast

**Duration:** 10-20 minutes

**Outputs:**

- Podcast audio: `YYYY-MM-DD_podcast.m4a`
- Screenshots: `reports/screenshots/notebooklm_*.png`

**Requirements:**

- Recent analysis report in `reports/`
- Recent NotebookLM document in `reports/`
- Files must have matching dates

**When to use:**

- Regenerate podcast with different duration
- Podcast generation failed previously
- Manual analysis, automated podcast

---

### npm run setup

Interactive configuration wizard.

```bash
npm run setup
```

**What it does:**

- Starts development server
- Opens browser to Aparture interface
- Lets you configure all settings visually
- Saves configuration to browser localStorage
- Closes automatically when done

**Duration:** 5-15 minutes (manual configuration)

**Configuration includes:**

- arXiv categories
- Research criteria
- Model selection for each stage
- Batch sizes and thresholds
- Optional stages (Quick Filter, Post-processing, NotebookLM)
- Podcast duration

**When to use:**

- First-time setup
- Change configuration
- Test different settings

---

## Testing Commands

### npm run test:dryrun

Run complete workflow with mock API (no costs).

```bash
npm run test:dryrun
```

**What it does:**

- Simulates complete analysis workflow
- Uses mock API responses (no real API calls)
- Tests browser automation
- Verifies download functionality
- Generates mock report

**Duration:** ~45 seconds

**Cost:** Free (no API calls)

**Outputs:**

- Mock report: `YYYY-MM-DD_arxiv_analysis_dryrun.md`
- Screenshots: `reports/screenshots/`

**When to use:**

- Verify installation
- Test configuration without costs
- Debug automation issues
- Demo the workflow

---

### npm run test:minimal

Run real analysis with 3 papers (minimal cost).

```bash
npm run test:minimal
```

**What it does:**

- Fetches 3 real papers from cs.LG
- Runs all analysis stages with real APIs
- Tests PDF download and analysis
- Generates real report

**Duration:** 5-10 minutes

**Cost:** ~$0.10-0.50 (depending on models)

**Outputs:**

- Real report: `YYYY-MM-DD_arxiv_analysis_minimal.md`
- Screenshots: `reports/screenshots/`

**When to use:**

- Validate API keys
- Test model behavior
- End-to-end verification
- Before production runs

---

## Build Commands

### npm run build

Build the Next.js application for production.

```bash
npm run build
```

**What it does:**

- Compiles application for production
- Optimizes bundles
- Generates static pages where possible
- Outputs to `.next/` directory

**Duration:** 30-60 seconds

**When to use:**

- Before deployment
- Performance optimization
- Production preparation

---

### npm run start

Start production server (requires prior build).

```bash
npm run build
npm run start
```

**What it does:**

- Starts optimized production server
- Serves built application
- Runs on http://localhost:3000

**When to use:**

- Test production build locally
- Deploy to server
- Production environment

---

## Documentation Commands

### npm run docs:dev

Start VitePress documentation development server.

```bash
npm run docs:dev
```

**What it does:**

- Starts documentation server on http://localhost:5173
- Enables hot reloading for doc changes
- Serves VitePress documentation site

**When to use:**

- Edit documentation
- Preview doc changes
- Local documentation browsing

---

### npm run docs:build

Build static documentation site.

```bash
npm run docs:build
```

**What it does:**

- Builds static HTML documentation
- Optimizes assets
- Outputs to `docs/.vitepress/dist/`

**When to use:**

- Deploy documentation
- Generate offline docs
- Production documentation build

---

### npm run docs:preview

Preview built documentation site.

```bash
npm run docs:build
npm run docs:preview
```

**What it does:**

- Serves built documentation
- Tests production documentation build
- Runs on http://localhost:4173

**When to use:**

- Verify documentation build
- Test before deployment

---

## Code Quality Commands

### npm run lint

Run ESLint to check code quality.

```bash
npm run lint
```

**What it does:**

- Scans all JavaScript/JSX files
- Reports code quality issues
- Checks for errors and warnings

**Exit codes:**

- 0: No issues found
- 1: Issues found

---

### npm run lint:fix

Run ESLint and automatically fix issues.

```bash
npm run lint:fix
```

**What it does:**

- Scans all JavaScript/JSX files
- Automatically fixes fixable issues
- Reports remaining issues

---

### npm run format

Check code formatting with Prettier.

```bash
npm run format
```

**What it does:**

- Checks all files against Prettier rules
- Reports formatting issues
- Does not modify files

---

### npm run format:fix

Format code with Prettier.

```bash
npm run format:fix
```

**What it does:**

- Formats all files according to Prettier rules
- Modifies files in place
- Reports changed files

---

## Common Workflows

### Daily Production Run

```bash
npm run analyze
```

Complete workflow: analysis → document → podcast

**Time:** 40-120 minutes
**Cost:** ~$4-6

---

### Quick Analysis (No Podcast)

```bash
npm run analyze:report
```

Analysis only, skip time-consuming podcast.

**Time:** 30-90 minutes
**Cost:** ~$3-5

---

### Test Before Production

```bash
# Free test
npm run test:dryrun

# Paid test (~$0.50)
npm run test:minimal

# If tests pass, run production
npm run analyze
```

---

### Regenerate Podcast

```bash
# Run analysis with document
npm run analyze:document

# Later, generate podcast with different settings
npm run analyze:podcast
```

---

### First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright
npx playwright install chromium

# 3. Configure settings
npm run setup

# 4. Test with dry run
npm run test:dryrun

# 5. Test with minimal
npm run test:minimal

# 6. Run production
npm run analyze
```

---

## Environment Variables

All commands respect environment variables from `.env.local`:

**Required:**

- `ACCESS_PASSWORD` - Web interface password
- At least one of:
  - `CLAUDE_API_KEY`
  - `OPENAI_API_KEY`
  - `GOOGLE_AI_API_KEY`

**Optional:**

- `NODE_ENV` - Environment mode
- `PORT` - Development server port

See [Environment Variables](/api-reference/environment) for details.

---

## Troubleshooting Commands

### Check Node Version

```bash
node --version
# Should be v18.0.0 or higher
```

---

### Check npm Version

```bash
npm --version
# Should be 8.0.0 or higher
```

---

### Verify Installation

```bash
npm list --depth=0
# Lists all installed packages
```

---

### Clear Cache and Reinstall

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

### Check Port Availability

```bash
# Mac/Linux
lsof -i:3000

# Windows
netstat -ano | findstr :3000
```

---

### Kill Process on Port

```bash
# Mac/Linux
lsof -ti:3000 | xargs kill -9

# Windows
# Find PID from netstat, then:
taskkill /PID <pid> /F
```

---

## Advanced Usage

### Custom Port

```bash
PORT=3001 npm run dev
```

---

### Production Build and Start

```bash
npm run build
NODE_ENV=production npm run start
```

---

### Watch Logs

```bash
npm run analyze 2>&1 | tee aparture.log
```

---

### Background Execution

```bash
# Linux/Mac
nohup npm run analyze > aparture.log 2>&1 &

# Windows (PowerShell)
Start-Process npm -ArgumentList "run analyze" -NoNewWindow
```

---

## Next Steps

- [Configure environment →](/api-reference/environment)
- [Understand configuration →](/api-reference/configuration)
- [Set up automation →](/user-guide/cli-automation)
