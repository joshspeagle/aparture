# Aparture CLI Automation

Comprehensive end-to-end automation for arXiv paper analysis and podcast generation using Playwright browser automation.

## Overview

The Aparture CLI provides a complete hands-free workflow from paper discovery to podcast generation:

1. **Setup** → Configure categories, models, and research criteria
2. **Analysis** → Automated multi-stage paper analysis (30-90 minutes)
3. **NotebookLM Document** → Generate podcast-optimized markdown
4. **Podcast Generation** → Automated Google NotebookLM interaction
5. **Output** → Download reports, documents, and podcasts

## Quick Start

```bash
# First time setup
npm run setup

# Full workflow (recommended)
npm run analyze

# Test with mock data (fast, no costs)
npm run test:dryrun
```

Note that while the sign-in for Aparture is automatic, the sign in for NotebookLM is not and will require a custom sign-in from the user the first time.

## Commands

### Setup and Configuration

```bash
npm run setup
```

Interactive configuration UI for:

- ArXiv categories to search
- AI models for each stage
- Score thresholds and batch sizes
- NotebookLM podcast duration (5-30 minutes)
- Research interests and criteria

All settings persist in browser localStorage for subsequent runs.

### Production Analysis

```bash
# Full workflow: analysis + document + podcast
npm run analyze

# Specific workflows
npm run analyze:report     # Report only (skip NotebookLM features)
npm run analyze:document   # Report + NotebookLM document (skip podcast)
npm run analyze:podcast    # Podcast only (skip analysis, use existing files)
```

The `analyze:podcast` command is useful when you already have a report and NotebookLM document from a previous run and just want to generate a new podcast. It automatically finds the most recent files in `reports/` by date prefix and skips directly to the podcast generation workflow.

### Testing

```bash
# Mock API test (fast, no costs)
npm run test:dryrun

# Real API test with a handful of papers (minimal costs)
npm run test:minimal

# NotebookLM test
npm run test:notebooklm
```

## Architecture

### Core Files

- **`run-analysis.js`** - Main pipeline orchestrator
  - Server lifecycle management
  - Complete workflow coordination
  - Error handling and logging

- **`browser-automation.js`** - Aparture website automation
  - Playwright integration
  - Authentication and session management
  - Form population and submission
  - Progress monitoring and completion detection
  - Report download

- **`notebooklm-automation.js`** - Google NotebookLM automation
  - Google OAuth authentication
  - Notebook creation and file upload
  - Podcast customization (Deep Dive, custom prompts)
  - Audio generation monitoring
  - Podcast download

- **`notebooklm-prompts.js`** - Prompt parsing utilities
  - Extracts duration from filename (e.g., "30min")
  - Loads matching prompt from NOTEBOOKLM_PROMPTS.md
  - Handles all supported durations (5min, 10min, 15min, 20min, 25min, 30min)

- **`setup.js`** - Interactive configuration
  - Category selection
  - Model configuration
  - Threshold settings
  - NotebookLM options

- **`server-manager.js`** - Next.js server lifecycle
  - Automatic startup with health checks
  - Graceful shutdown
  - Port conflict detection

- **`config-manager.js`** - Configuration management
  - LocalStorage integration
  - Config file operations

### Test Files

Located in `cli/tests/`:

- `test-browser-basic.js` - Phase 1: Basic browser automation
- `test-browser-auth.js` - Phase 2: Authentication
- `test-browser-dryrun.js` - Phase 3: Dry run workflow
- `test-browser-minimal.js` - Phase 4: Minimal API test (3 papers)
- `test-notebooklm.js` - Phase 6: NotebookLM automation test

## Workflow Details

### Step-by-Step Process

When you run `npm run analyze`, the CLI performs these steps automatically:

1. **Server Startup** (10-15 seconds)
   - Launches Next.js development server
   - Waits for compilation to complete
   - Verifies server is ready

2. **Browser Launch** (2-3 seconds)
   - Opens Chromium browser (visible for monitoring)
   - Navigates to localhost:3000

3. **Authentication** (1-2 seconds)
   - Enters ACCESS_PASSWORD from .env.local
   - Verifies successful login

4. **Configuration Loading** (1 second)
   - Reads saved settings from browser localStorage
   - Validates configuration

5. **Analysis Execution** (30-90 minutes)
   - **Stage 1**: ArXiv fetching (1-5 minutes)
   - **Stage 2**: Quick filtering - YES/NO/MAYBE (if enabled, 2-5 minutes)
   - **Stage 3**: Abstract scoring (10-30 minutes depending on paper count)
   - **Stage 4**: Post-processing (if enabled, 5-15 minutes)
   - **Stage 5**: PDF analysis (15-45 minutes depending on paper count)
   - Progress screenshots every 5 minutes

6. **Report Download** (1-2 seconds)
   - Automatic capture of markdown report
   - Saved to `reports/YYYY-MM-DD_arxiv_analysis_XXmin.md`

7. **NotebookLM Document Generation** (if not skipped, 1-3 minutes)
   - Generates podcast-optimized markdown
   - Downloads to `reports/YYYY-MM-DD_notebooklm_XXmin.md`

8. **Podcast Generation** (if not skipped, 10-20 minutes)
   - **Google Authentication** (first run only, 1-2 minutes)
     - Browser opens Google OAuth login
     - User completes authentication
     - Session cached in `temp/notebooklm-profile/`
   - **Notebook Creation** (5 seconds)
     - Creates notebook with format: `YYYY-MM-DD_aparture`
   - **File Upload** (10-15 seconds)
     - Uploads report and NotebookLM document
     - Waits for processing
   - **Customization** (5-10 seconds)
     - Opens Audio Overview customization
     - Sets Deep Dive format, Default length
     - Pastes custom prompt from NOTEBOOKLM_PROMPTS.md
   - **Generation** (10-20 minutes)
     - Monitors progress with updates every 30 seconds
     - Waits for completion (up to 30 minute timeout)
   - **Download** (2-5 seconds)
     - Downloads podcast audio
     - Saved to `reports/YYYY-MM-DD_podcast.m4a`

9. **Cleanup** (2-3 seconds)
   - Closes browsers
   - Shuts down server
   - Displays summary with file paths

### Progress Monitoring

- **Analysis Progress**: Visible in browser window (kept open for monitoring)
- **Console Output**: Detailed logging of each step
- **Screenshots**: Captured at key milestones in `reports/screenshots/`
- **Podcast Generation**: Progress updates every 30 seconds

## Authentication

### Aparture Authentication

Uses `ACCESS_PASSWORD` from `.env.local`:

```bash
ACCESS_PASSWORD=your-secure-password-here
```

Cleared from memory after each run for security.

### Google NotebookLM Authentication

**First Run (Interactive)**:

1. Browser window opens automatically
2. Complete Google OAuth login
3. Session cached for future runs

**Subsequent Runs (Automatic)**:

- Uses cached session from `temp/notebooklm-profile/`
- No manual interaction needed

## Output Files

All outputs saved to `reports/` directory:

### Main Outputs

- `YYYY-MM-DD_arxiv_analysis_XXmin.md` - Complete analysis report
  - Paper metadata (titles, authors, abstracts, URLs)
  - Relevance scores with justifications
  - Top papers with detailed PDF analysis
  - Category breakdowns and statistics

- `YYYY-MM-DD_notebooklm_XXmin.md` - Podcast-optimized document
  - Structured for NotebookLM audio generation
  - Citation-focused format
  - Organized by research themes
  - Duration-specific content (XX = target minutes)

- `YYYY-MM-DD_podcast.m4a` - Generated podcast audio
  - Deep Dive format (conversational, in-depth)
  - Custom-prompted based on duration
  - Ready for listening or further processing

### Debug Outputs

`reports/screenshots/` directory contains:

- `full-ready.png` - Initial state before analysis
- `full-started.png` - Analysis started confirmation
- `full-complete.png` - Analysis completion
- `notebooklm-complete.png` - NotebookLM document generated
- `notebooklm-authenticated.png` - Google authentication success
- `notebooklm-notebook-created.png` - Notebook created in NotebookLM
- `notebooklm-files-uploaded.png` - Files uploaded
- `notebooklm-customization-dialog.png` - Customization settings
- `notebooklm-generation-started.png` - Podcast generation started
- `notebooklm-generation-complete.png` - Podcast ready for download
- `notebooklm-error.png` - Error state (if any)

## Troubleshooting

### Server Issues

**Problem**: Server fails to start or times out
**Solution**:

```bash
# Check if port 3000 is already in use
lsof -i :3000

# Kill any existing process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run analyze
```

### Authentication Issues

**Problem**: Password authentication fails
**Solution**:

- Verify `ACCESS_PASSWORD` in `.env.local`
- Check browser console for errors
- Screenshot saved to `reports/screenshots/` for debugging

**Problem**: Google authentication fails
**Solution**:

- Clear cached profile: `rm -rf temp/notebooklm-profile/`
- Run again and complete OAuth flow
- Ensure you're using a Google account with NotebookLM access

### Podcast Generation Issues

**Problem**: Audio Overview button stays disabled
**Solution**:

- CLI automatically refreshes page every 15 seconds
- Wait up to 2 minutes for source processing
- If still disabled, check screenshot in `reports/screenshots/notebooklm-error.png`

**Problem**: Podcast generation times out
**Solution**:

- Default timeout is 30 minutes
- Generation typically takes 10-20 minutes
- If timeout occurs, podcast may still be available in NotebookLM web interface
- Access notebook manually: https://notebooklm.google.com

### Browser Issues

**Problem**: Browser closes prematurely
**Solution**:

- CLI uses visible browser windows (not headless) for monitoring
- If window closes unexpectedly, check console output for errors
- Screenshots captured before closure available in `reports/screenshots/`

## Advanced Usage

### Custom Configuration

Edit settings via `npm run setup` or modify directly in browser:

1. Run `npm run dev`
2. Navigate to http://localhost:3000
3. Enter password
4. Configure settings
5. Settings auto-save to localStorage
6. Exit and run `npm run analyze`

Note that this must be the same browser instance (default: Chromium) or else the settings will not be saved.

### Selective Execution

```bash
# Specific workflows
npm run analyze:report     # Just generate report (no NotebookLM)
npm run analyze:document   # Generate document but skip podcast
npm run analyze:podcast    # Podcast from existing files

# Test pipeline without full analysis
npm run test:dryrun
npm run test:minimal
```

### Testing NotebookLM Independently

```bash
# Test NotebookLM automation with existing files
node cli/tests/test-notebooklm.js
```

Uses existing report files from `reports/` to test podcast generation without running full analysis.

## Development

### Running Individual Test Phases

```bash
# Phase 1: Browser basics
node cli/tests/test-browser-basic.js

# Phase 2: Authentication
node cli/tests/test-browser-auth.js

# Phase 3: Dry run
node cli/tests/test-browser-dryrun.js
npm run test:dryrun

# Phase 4: Minimal API test
node cli/tests/test-browser-minimal.js
npm run test:minimal

# Phase 6b: NotebookLM
node cli/tests/test-notebooklm.js
```

### File Structure

```
cli/
├── README.md                   # This file
├── PHASE_PLAN.md              # Detailed phase implementation plan
├── run-analysis.js            # Main pipeline orchestrator
├── browser-automation.js      # Aparture automation
├── notebooklm-automation.js   # NotebookLM automation
├── notebooklm-prompts.js      # Prompt parsing utilities
├── setup.js                   # Interactive configuration
├── server-manager.js          # Server lifecycle
├── config-manager.js          # Config management
└── tests/                     # Test files for each phase
    ├── test-browser-basic.js
    ├── test-browser-auth.js
    ├── test-browser-dryrun.js
    ├── test-browser-minimal.js
    ├── test-notebooklm.js
    ├── test-config.js
    ├── test-server.js
    ├── test-pdf-download.js
    └── test-playwright-pdf.js
```

## Known Limitations

1. **NotebookLM UI Selectors**: May break with Google NotebookLM UI updates
2. **Google Authentication**: Requires interactive login on first podcast generation
3. **Browser Visibility**: Browsers kept visible for monitoring (not headless)
4. **Podcast Timeout**: 30-minute limit for audio generation
5. **No Official API**: NotebookLM automation uses browser automation (no official API available)

## Support

- **GitHub Issues**: https://github.com/joshspeagle/aparture/issues
- **Documentation**: See main README.md
- **Logs**: Check console output and screenshots in `reports/screenshots/`

## License

MIT - See main LICENSE file

## Acknowledgements

CLI automation created in collaboration with Claude Sonnet 4.5 and Claude Opus 4.1.
