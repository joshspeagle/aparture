# CLI Automation

Complete guide to Aparture's command-line automation for unattended daily analysis runs.

## Overview

The CLI automation system provides fully automated, unattended analysis runs using Playwright browser automation. Perfect for:

- **Daily automated runs** - Set and forget
- **Consistent scheduling** - Same configuration every time
- **Complete workflow** - Analysis + NotebookLM + Podcast generation
- **Headless operation** - No manual interaction needed

## Quick Start

### First Time Setup

Configure your settings once:

```bash
npm run setup
```

This interactive wizard will:

1. Start the development server
2. Open a browser to the Aparture interface
3. Let you configure all settings visually
4. Save configuration to browser localStorage
5. Close automatically when done

### Running Analysis

After setup, run analysis with one command:

```bash
npm run analyze
```

This will:

- Start Next.js dev server
- Open browser with saved configuration
- Authenticate automatically
- Run complete analysis (30-90 min typical)
- Generate NotebookLM document
- Upload to Google NotebookLM
- Generate and download podcast
- Save all outputs to `reports/`
- Close browser and shut down server

## Available Commands

### Full Workflow

```bash
npm run analyze
```

**What it does:**

- Complete analysis pipeline
- NotebookLM document generation
- Podcast generation (requires Google auth first time)

**Duration:** 40-120 minutes
**Outputs:** Report + NotebookLM document + Podcast audio

### Report Only

```bash
npm run analyze:report
```

**What it does:**

- Complete analysis pipeline only
- Skips NotebookLM document
- Skips podcast generation

**Duration:** 30-90 minutes
**Outputs:** Analysis report only

### Report + Document

```bash
npm run analyze:document
```

**What it does:**

- Complete analysis pipeline
- Generates NotebookLM document
- Skips podcast generation

**Duration:** 30-90 minutes
**Outputs:** Report + NotebookLM document

### Podcast Only

```bash
npm run analyze:podcast
```

**What it does:**

- Skips analysis (uses existing files)
- Uses most recent report and NotebookLM document
- Uploads to NotebookLM and generates podcast

**Duration:** 10-20 minutes
**Outputs:** Podcast audio only

**Requirements:**

- Existing analysis report in `reports/`
- Existing NotebookLM document in `reports/`
- Files must be from same date (verified automatically)

### Testing

```bash
npm run test:dryrun    # Mock API test (free, fast)
npm run test:minimal   # Real API test (3 papers, ~$0.10)
```

See [Testing Guide](/user-guide/testing) for details.

## Configuration

### Initial Setup

Run the setup wizard:

```bash
npm run setup
```

**Configure:**

- arXiv categories
- Research criteria
- Models for each stage
- Batch sizes and thresholds
- Optional stages (Quick Filter, Post-processing, NotebookLM)
- Podcast duration

All settings are saved in browser localStorage and persist across runs.

### Updating Configuration

To change settings:

```bash
npm run setup
```

This will open the interface with your current settings loaded. Make changes and they'll be saved automatically.

### Configuration Location

Settings are stored in:

```
temp/playwright-profile/Default/Local Storage/
```

This persistent browser profile preserves:

- Your configuration
- Authentication state
- Session cookies

## Workflow Details

### Stage 1: Server Management

```
✓ Starting Next.js development server...
✓ Server ready on http://localhost:3000
```

The automation manages the dev server lifecycle:

- Starts server automatically
- Waits for ready state
- Monitors for errors
- Shuts down cleanly after completion

### Stage 2: Authentication

```
✓ Authenticating with ACCESS_PASSWORD...
✓ Logged in successfully
```

Uses your `ACCESS_PASSWORD` from `.env.local`:

- Clears any existing password in localStorage
- Enters password programmatically
- Verifies successful login

### Stage 3: Configuration Loading

```
✓ Loading saved configuration...
✓ Configuration verified:
  - Categories: cs.LG, cs.AI, stat.ML (47 papers expected)
  - Quick Filter: Enabled (Haiku 4.5)
  - Abstract Scoring: Sonnet 4.5
  - PDF Analysis: Opus 4.1 (20 papers max)
  - NotebookLM: Enabled (15 min duration)
```

Loads settings from localStorage and displays summary.

### Stage 4: Analysis Execution

```
✓ Starting analysis...
⏳ Fetching papers... (1-5 min)
✓ Fetched 47 papers

⏳ Quick Filter... (2-5 min)
✓ Filtered: 20 YES, 10 MAYBE, 17 NO

⏳ Scoring abstracts... (10-30 min)
✓ Scored 30 papers (avg: 6.2/10)

⏳ Analyzing PDFs... (15-45 min)
✓ Analyzed 20 papers

⏳ Generating NotebookLM document... (1-3 min)
✓ Document generated
```

Monitors each stage and logs progress:

- Stage transitions
- Paper counts
- Timing information
- Status indicators

### Stage 5: Report Download

```
✓ Downloading analysis report...
  Saved: reports/2025-10-14_arxiv_analysis_45min.md

✓ Downloading NotebookLM document...
  Saved: reports/2025-10-14_notebooklm_15min.md
```

Automatically downloads both files to `reports/`:

- Waits for download buttons to appear
- Handles browser download events
- Verifies files were saved
- Reports file sizes

### Stage 6: NotebookLM Automation (Optional)

```
✓ Opening NotebookLM...
✓ Authenticating with Google... (first run: manual login required)
✓ Creating new notebook...
✓ Uploading files (2 files)...
  - Uploaded: 2025-10-14_arxiv_analysis_45min.md (142 KB)
  - Uploaded: 2025-10-14_notebooklm_15min.md (85 KB)

⏳ Generating podcast... (10-20 min)
  Applying custom 15-minute prompt...
  Waiting for audio generation...
  [Refreshing every 30s to check status]

✓ Podcast generated!
✓ Downloading audio...
  Saved: reports/2025-10-14_podcast.m4a (18.3 MB)
```

Fully automates NotebookLM workflow:

- Opens Google NotebookLM
- Handles authentication (interactive first time)
- Creates notebook and uploads files
- Applies custom duration prompt
- Monitors generation progress
- Downloads finished audio

### Stage 7: Cleanup

```
✓ Taking final screenshot...
✓ Closing browser...
✓ Shutting down server...

✅ Analysis complete!
   Duration: 58 minutes
   Outputs: 3 files in reports/
```

Clean shutdown:

- Captures final screenshot
- Closes browser properly
- Stops dev server
- Reports total time

## Google Authentication

### First Run

The first time you generate a podcast:

1. **Browser opens to Google login**
2. **You manually sign in**
3. **Grant NotebookLM permissions**
4. **Session is cached**

After this, all future runs are fully automated.

### Session Expiration

Google sessions last weeks to months. If expired:

1. Automation will detect and pause
2. Browser stays open for manual login
3. You complete login
4. Automation resumes automatically

### Cached Session Location

```
temp/notebooklm-profile/Default/
```

This persistent browser profile preserves your Google login.

## Custom Podcast Prompts

Aparture uses custom prompts to guide podcast generation based on duration.

### Prompts File

Edit `NOTEBOOKLM_PROMPTS.md` to customize:

```markdown
## 15-minute

Focus on 5-7 top papers with moderate technical depth.
Provide balanced coverage of methodology and results.
Target 2-3 minutes per major paper...
```

### Available Durations

- 5 minutes - Quick highlights
- 10 minutes - Standard summary
- 15 minutes - Detailed overview (default)
- 20 minutes - Comprehensive discussion
- 25 minutes - Extended analysis
- 30 minutes - Deep dive

The automation automatically selects the prompt based on your configured duration.

## Output Files

All files are saved to `reports/` with timestamps:

### Analysis Report

```
reports/2025-10-14_arxiv_analysis_45min.md
```

**Contains:**

- Configuration summary
- Executive summary
- All scored papers
- PDF analyses
- Timing and cost breakdown

**Size:** 50-500 KB

### NotebookLM Document

```
reports/2025-10-14_notebooklm_15min.md
```

**Contains:**

- Podcast-optimized summaries
- Thematic organization
- Connected insights
- Audio-friendly structure

**Size:** 30-150 KB

### Podcast Audio

```
reports/2025-10-14_podcast.m4a
```

**Contains:**

- AI-generated audio overview
- Two-host conversation format
- Duration matches configured setting

**Size:** 5-30 MB (1-3 MB per minute)

### Screenshots

```
reports/screenshots/
  analysis-start.png
  fetching-papers.png
  scoring-complete.png
  pdf-analysis.png
  notebooklm-upload.png
  podcast-ready.png
  final.png
```

Automatic screenshots at key milestones for debugging.

## Scheduling

### Linux/Mac (cron)

Run daily at 2 PM:

```bash
# Edit crontab
crontab -e

# Add line
0 14 * * * cd /path/to/aparture && npm run analyze >> ~/aparture.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task
3. **Trigger:** Daily at 2:00 PM
4. **Action:** Start a program
5. **Program:** `cmd.exe`
6. **Arguments:** `/c cd /d D:\path\to\aparture && npm run analyze`

### Docker/Systemd

Example systemd timer:

```ini
# /etc/systemd/system/aparture.timer
[Unit]
Description=Aparture daily analysis

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/aparture.service
[Unit]
Description=Aparture analysis

[Service]
Type=oneshot
WorkingDirectory=/path/to/aparture
ExecStart=/usr/bin/npm run analyze
```

Enable:

```bash
sudo systemctl enable aparture.timer
sudo systemctl start aparture.timer
```

## Troubleshooting

### Server Fails to Start

**Error:** Port 3000 already in use

**Solution:**

```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :3000   # Windows (find PID, then taskkill)
```

### Authentication Fails

**Error:** Login screen doesn't accept password

**Check:**

- `ACCESS_PASSWORD` in `.env.local` is correct
- No extra spaces in password
- Server started successfully

**Solution:**

```bash
# Clear browser profile
rm -rf temp/playwright-profile
npm run setup  # Reconfigure
```

### Configuration Not Loading

**Error:** Analysis starts with default settings

**Solution:**

```bash
# Run setup again
npm run setup

# Verify localStorage saved
# (Wizard should show "Configuration saved")
```

### Podcast Generation Timeout

**Error:** Podcast generation exceeds 30-minute timeout

**Causes:**

- Very long documents
- High NotebookLM server load
- Network issues

**Solutions:**

- Reduce podcast duration setting
- Retry at off-peak hours
- Check NotebookLM status page

### Google Authentication Fails

**Error:** Can't log in to Google

**Solutions:**

- Check internet connection
- Try in regular browser first
- Clear `temp/notebooklm-profile/`
- Check if NotebookLM is available in your region

### Files Not Found (Podcast Only Mode)

**Error:** "No analysis report found in reports/"

**Check:**

- Recent report exists in `reports/`
- Recent NotebookLM document exists
- Files are from the same date (YYYY-MM-DD prefix)

**Solution:**

```bash
# List recent files
ls -lt reports/*.md | head -5

# If missing, run full analysis first
npm run analyze:document
```

## Advanced Usage

### Custom Browser Options

Edit `cli/browser-automation.js` to customize Playwright:

```javascript
const browser = await playwright.chromium.launch({
  headless: true, // Set false to watch
  slowMo: 0, // Add delay for debugging
  timeout: 30000, // Global timeout
  args: ['--window-size=1920,1080'],
});
```

### Custom Server Port

Set via environment variable in `.env.local`:

```bash
PORT=3001
```

Or pass directly:

```bash
PORT=3001 npm run analyze
```

The CLI scripts will automatically use the PORT environment variable if set.

### Multiple Configurations

Create profile-specific configurations:

```bash
# Research profile
PLAYWRIGHT_PROFILE=research npm run analyze

# Teaching profile
PLAYWRIGHT_PROFILE=teaching npm run analyze
```

Edit `cli/browser-automation.js` to use different profile directories.

## Performance Tips

### Faster Execution

1. **Use SSD** - Significant impact on server startup
2. **Close other apps** - Free up RAM and CPU
3. **Wired connection** - More reliable than WiFi
4. **Off-peak hours** - API rate limits less likely

### Cost Optimization

1. **Enable Quick Filter** - Saves 40-60% on scoring
2. **Batch size tuning** - Larger batches = fewer API calls
3. **Model selection** - Use Haiku/Flash for filtering
4. **PDF limit** - Reduce to 10-15 for daily runs

### Reliability

1. **Persistent profile** - Saves authentication state
2. **Auto-retry** - Built into API calls
3. **Progress screenshots** - Debug failed runs
4. **Server monitoring** - Detects crashes early

## Next Steps

- [Set up testing →](/user-guide/testing)
- [Understand reports →](/user-guide/reports)
- [Optimize configuration →](/concepts/model-selection)
