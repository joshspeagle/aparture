#!/usr/bin/env node

/**
 * run-analysis.js
 *
 * Aparture CLI - Full Production Analysis
 *
 * Automates the complete arXiv paper analysis workflow:
 * - Starting full analysis with "Start Analysis" button
 * - Monitoring all stages: fetching → filtering → scoring → post-processing → pdf-analysis
 * - Progress tracking through hundreds of papers
 * - Handling long runtimes (30-90+ minutes)
 * - Downloading comprehensive report
 * - Generating NotebookLM podcast-optimized document (optional)
 * - Uploading to NotebookLM and generating podcast (optional)
 * - Verifying complete analysis results
 *
 * Setup (first time):
 *   npm run setup              # Interactive configuration UI
 *
 * Usage:
 *   npm run analyze            # Full workflow: report + document + podcast
 *   npm run analyze:report     # Report only (skip NotebookLM features)
 *   npm run analyze:document   # Report + NotebookLM document (skip podcast)
 *   npm run analyze:podcast    # Podcast only (skip analysis, use existing files)
 *
 * Configuration:
 *   - First run "npm run setup" to configure all settings via UI
 *   - Settings persist in browser localStorage for subsequent runs
 *   - Categories, models, thresholds, NotebookLM options all saved automatically
 *   - Google authentication for NotebookLM (interactive on first podcast generation)
 *
 * NOTE: This uses extensive real API calls and will incur significant costs!
 * Runtime: Typically 30-90 minutes for analysis + 10-20 minutes for podcast generation
 */

const BrowserAutomation = require('./browser-automation');
const NotebookLMAutomation = require('./notebooklm-automation');
const { getPromptForFile, extractDurationFromFilename } = require('./notebooklm-prompts');
const { ServerManager } = require('./server-manager');
const path = require('path');
const fs = require('fs').promises;

// Parse command-line arguments
const args = process.argv.slice(2);
const skipNotebookLM = args.includes('--skip-notebooklm') || args.includes('--no-notebooklm');
const skipPodcast = args.includes('--skip-podcast') || args.includes('--no-podcast');
const podcastOnly = args.includes('--podcast-only');

// Configuration
const CONFIG = {
  serverPort: 3000,
  screenshotDir: path.join(__dirname, '../reports/screenshots'),
  downloadDir: path.join(__dirname, '../reports'),
  headless: false, // Keep visible for monitoring progress
  envFile: path.join(__dirname, '../.env.local'),
  fullAnalysisTimeout: 7200000, // 120 minutes (2 hours) - runtimes often around 80 minutes
  pollInterval: 5000, // Check progress every 5 seconds
  screenshotInterval: 300000, // Take screenshot every 5 minutes
  generateNotebookLM: !skipNotebookLM, // Generate NotebookLM by default (disable with --skip-notebooklm)
  notebookLMTimeout: 300000, // 5 minutes for NotebookLM generation
  generatePodcast: !skipPodcast, // Generate podcast via NotebookLM external automation (disable with --skip-podcast)
  podcastGenerationTimeout: 1800000, // 30 minutes for podcast generation
};

/**
 * Log status message
 */
function log(message, passed = true) {
  const icon = passed ? '✓' : '✗';
  console.log(`${icon} ${message}`);
}

/**
 * Format duration for display
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Read password from .env.local
 */
async function readPassword() {
  try {
    const envContent = await fs.readFile(CONFIG.envFile, 'utf-8');
    const match = envContent.match(/ACCESS_PASSWORD=(.+)/);
    if (match) {
      return match[1].trim();
    }
    throw new Error('ACCESS_PASSWORD not found in .env.local');
  } catch (error) {
    throw new Error(`Failed to read password: ${error.message}`);
  }
}

/**
 * Find most recent files by date prefix in filename
 * @param {string} directory - Directory to search
 * @param {string} pattern - Filename pattern (e.g., 'aparture_analysis', 'notebooklm')
 * @returns {Promise<string|null>} - Path to most recent file, or null if not found
 */
async function findMostRecentFile(directory, pattern) {
  try {
    const files = await fs.readdir(directory);

    // Filter files matching pattern and extract date prefix
    const matchingFiles = files
      .filter((f) => f.includes(pattern))
      .map((f) => {
        const match = f.match(/^(\d{4}-\d{2}-\d{2})/);
        return {
          name: f,
          date: match ? match[1] : null,
          path: path.join(directory, f),
        };
      })
      .filter((f) => f.date !== null)
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending by date

    if (matchingFiles.length === 0) {
      return null;
    }

    return matchingFiles[0].path;
  } catch {
    return null;
  }
}

/**
 * Verify report file contents
 */
async function verifyReport(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  // Check for key sections in full analysis report
  const checks = {
    hasTitle:
      content.includes('arXiv') ||
      content.includes('Aparture') ||
      content.includes('Analysis Report'),
    hasMetadata: content.includes('Generated') || content.includes('Duration'),
    hasPapers: /Papers? Analyzed.*\d+/i.test(content) || /\d+\s+papers/i.test(content), // Match "Papers Analyzed: 20" or "344 papers"
    hasScores: content.includes('Score:') || content.includes('**Score:**'),
    hasCategories:
      content.includes('Categories:') || content.includes('cs.') || content.includes('stat.'),
    hasAnalysis: content.includes('Relevance Assessment') || content.includes('Abstract'),
    hasContent: content.length > 5000, // Full reports are substantial
  };

  const allPassed = Object.values(checks).every((v) => v);

  return {
    passed: allPassed,
    checks,
    size: content.length,
  };
}

/**
 * Run podcast-only workflow using existing report and NotebookLM files
 */
async function runPodcastOnly() {
  let notebookLM = null;

  try {
    console.log('\n=== Aparture: Podcast-Only Mode ===\n');
    console.log('Finding most recent report and NotebookLM document...\n');

    // Find most recent files
    const reportFile = await findMostRecentFile(CONFIG.downloadDir, 'arxiv_analysis');
    const notebookLMFile = await findMostRecentFile(CONFIG.downloadDir, 'notebooklm');

    if (!reportFile) {
      throw new Error('No analysis report found in reports/ directory');
    }
    if (!notebookLMFile) {
      throw new Error('No NotebookLM document found in reports/ directory');
    }

    // Extract dates and verify they match
    const reportDate = path.basename(reportFile).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const notebookDate = path.basename(notebookLMFile).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];

    console.log(`Found report: ${path.basename(reportFile)}`);
    console.log(`Found NotebookLM document: ${path.basename(notebookLMFile)}`);

    if (reportDate !== notebookDate) {
      console.log(`\n⚠️  WARNING: Files are from different dates!`);
      console.log(`  Report date: ${reportDate}`);
      console.log(`  NotebookLM date: ${notebookDate}`);
      console.log(`  This may indicate mismatched files from different analysis runs.`);
      console.log(`  Continuing anyway, but you may want to verify these are the correct files.\n`);
    } else {
      console.log(`✓ Files are from the same analysis (${reportDate})\n`);
    }

    // Verify files exist and are readable
    const reportStats = await fs.stat(reportFile);
    const notebookStats = await fs.stat(notebookLMFile);

    console.log(`Report size: ${Math.round(reportStats.size / 1024)} KB`);
    console.log(`NotebookLM document size: ${Math.round(notebookStats.size / 1024)} KB\n`);

    // Extract date prefix for naming
    const reportBasename = path.basename(reportFile);
    const dateMatch = reportBasename.match(/^(\d{4}-\d{2}-\d{2})/);
    const datePrefix = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    const notebookName = `${datePrefix}_aparture`;

    console.log('Starting podcast generation...\n');

    notebookLM = new NotebookLMAutomation();

    // Launch browser
    console.log('Step 1: Launching browser for NotebookLM...');
    await notebookLM.launch({ headless: false });
    log('NotebookLM browser launched');

    // Authenticate with Google (interactive on first run)
    console.log('\nStep 2: Authenticating with Google...');
    await notebookLM.ensureAuthenticated({ timeout: 120000 });
    log('Authenticated with Google');

    // Create notebook
    console.log(`\nStep 3: Creating notebook: ${notebookName}...`);
    await notebookLM.createNotebook(notebookName);
    log(`Notebook created: ${notebookName}`);

    // Take screenshot after notebook creation
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'notebooklm-notebook-created.png')
    );

    // Upload files
    console.log('\nStep 4: Uploading report and NotebookLM document...');
    await notebookLM.uploadFiles(reportFile, notebookLMFile);
    log('Files uploaded successfully');

    // Take screenshot after file upload
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'notebooklm-files-uploaded.png')
    );

    // Extract duration and get appropriate prompt
    console.log('\nStep 5: Configuring podcast generation...');
    const duration = extractDurationFromFilename(notebookLMFile);
    console.log(`  Podcast duration target: ${duration}`);

    const customPrompt = await getPromptForFile(notebookLMFile);
    console.log(
      `  Custom prompt loaded from NOTEBOOKLM_PROMPTS.md (${customPrompt.length} characters)`
    );

    // Generate audio overview with customization
    console.log('  Configuring audio overview (Deep Dive, Default length)...');
    await notebookLM.generateAudioOverview(customPrompt, duration);
    log('Audio generation started');

    // Take screenshot of customization dialog (captured during generateAudioOverview)
    log('Screenshot captured: notebooklm-customization-dialog.png');

    // Take screenshot of generation start
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'notebooklm-generation-started.png')
    );

    // Wait for generation to complete
    console.log('\nStep 6: Waiting for podcast generation...');
    console.log('  This typically takes 10-20 minutes. Progress updates will appear below.');
    const podcastStartTime = Date.now();
    await notebookLM.waitForAudioGeneration({
      timeout: CONFIG.podcastGenerationTimeout,
    });
    const podcastDuration = Date.now() - podcastStartTime;
    log(`Podcast generation completed in ${formatDuration(podcastDuration)}`);

    // Take screenshot of completion
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'notebooklm-generation-complete.png')
    );

    // Download podcast
    console.log('\nStep 7: Downloading podcast...');
    const podcastFileName = `${datePrefix}_podcast.m4a`;
    console.log(`  Filename: ${podcastFileName}...`);
    const podcastFile = await notebookLM.downloadAudio(CONFIG.downloadDir, podcastFileName);
    log(`Podcast downloaded: ${podcastFile}`);

    // Verify file was downloaded
    const podcastStats = await fs.stat(podcastFile);
    const podcastSizeMB = (podcastStats.size / (1024 * 1024)).toFixed(2);
    log(`Podcast file size: ${podcastSizeMB} MB`);

    // Keep browser open briefly for inspection
    console.log('\n  Keeping browser open for 5 seconds for inspection...');
    await notebookLM.getPage().waitForTimeout(5000);

    // Close NotebookLM browser
    await notebookLM.close();
    log('NotebookLM browser closed');

    // Success!
    console.log('\n' + '='.repeat(70));
    console.log('✓ Podcast Generation Complete!');
    console.log('='.repeat(70));

    console.log('\n=== Summary ===');
    console.log('Input files:');
    console.log(`  Report: ${reportFile}`);
    console.log(`  NotebookLM document: ${notebookLMFile}`);
    console.log('\nOutput:');
    console.log(`  Podcast: ${podcastFile}`);
    console.log(`  Duration: ${formatDuration(podcastDuration)}`);
    console.log('');
  } catch (error) {
    console.error('\n✗ Podcast generation failed:', error.message);

    // Take error screenshot
    try {
      if (notebookLM) {
        await notebookLM.takeScreenshot(path.join(CONFIG.screenshotDir, 'notebooklm-error.png'));
      }
    } catch {
      // Ignore screenshot errors
    }

    console.error('');
    process.exit(1);
  } finally {
    // Cleanup
    if (notebookLM) {
      try {
        await notebookLM.close();
        console.log('✓ NotebookLM browser closed');
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Run Phase 5 full production analysis test
 */
async function runAnalysis() {
  const browser = new BrowserAutomation();
  const server = new ServerManager(CONFIG.serverPort);
  let serverStartedByTest = false;
  let downloadedFile = null;
  let screenshotCount = 0;

  const stageTimings = {};
  let totalStartTime = null;

  try {
    console.log('\n=== Aparture: Full arXiv Analysis ===\n');
    console.log(
      '⚠️  WARNING: This uses extensive real API calls and will incur significant costs!'
    );
    console.log('    Expected runtime: 30-90 minutes depending on configuration');
    if (CONFIG.generateNotebookLM) {
      console.log('    NotebookLM document: ENABLED (add --skip-notebooklm to disable)');
    } else {
      console.log('    NotebookLM document: DISABLED');
    }
    if (CONFIG.generatePodcast) {
      console.log('    Podcast generation: ENABLED (add --skip-podcast to disable)');
    } else {
      console.log('    Podcast generation: DISABLED');
    }
    console.log('');

    // Step 1: Get password
    console.log('Step 1: Reading password from .env.local...');
    const password = await readPassword();
    log(`Password loaded: ${password.substring(0, 4)}****`);

    // Step 2: Ensure server is running
    console.log('\nStep 2: Checking server status...');
    const serverInfo = await server.ensure();
    serverStartedByTest = serverInfo.started === true;
    log(`Server running at ${server.getBaseUrl()}`);

    // Step 3: Launch browser
    console.log('\nStep 3: Launching browser...');
    await browser.launch(CONFIG.headless);
    log('Browser launched');

    // Step 4: Navigate and authenticate
    console.log('\nStep 4: Navigating and authenticating...');
    await browser.navigate(server.getBaseUrl());

    // Clear saved password from localStorage to force re-authentication
    // (preserves other config like model selections, categories, etc.)
    await browser.getPage().evaluate(() => {
      const state = localStorage.getItem('arxivAnalyzerState');
      if (state) {
        const parsed = JSON.parse(state);
        if (parsed.password) {
          delete parsed.password;
          localStorage.setItem('arxivAnalyzerState', JSON.stringify(parsed));
        }
      }
    });

    // Reload to apply cleared authentication
    await browser.getPage().reload({ waitUntil: 'domcontentloaded' });

    await browser.authenticate(password);
    log('Authenticated successfully');

    // Step 5: Take initial screenshot
    console.log('\nStep 5: Capturing initial state...');
    await browser.takeScreenshot(path.join(CONFIG.screenshotDir, 'full-ready.png'), {
      fullPage: true,
    });
    log('Screenshot captured: full-ready.png');

    // Step 6: Set up automatic download handling
    console.log('\nStep 6: Setting up download monitoring...');
    let autoDownloadCaptured = false;

    browser.getPage().on('download', async (download) => {
      try {
        const fileName = download.suggestedFilename();
        const filePath = `${CONFIG.downloadDir}/${fileName}`;
        await download.saveAs(filePath);
        console.log(`\n  📥 Automatic download captured: ${fileName}`);
        downloadedFile = filePath;
        autoDownloadCaptured = true;
      } catch (_err) {
        console.log(`  Note: Automatic download encountered issue: ${_err.message}`);
      }
    });
    log('Download monitoring active');

    // Step 7: Start full analysis
    console.log('\nStep 7: Starting full analysis...');
    console.log('  Clicking "Start Analysis" button...');
    await browser.startFullAnalysis();
    log('Full analysis started');
    totalStartTime = Date.now();

    // Wait a moment
    await browser.getPage().waitForTimeout(3000);

    // Take screenshot of analysis starting
    await browser.takeScreenshot(path.join(CONFIG.screenshotDir, 'full-started.png'), {
      fullPage: true,
    });
    log('Screenshot captured: full-started.png');

    // Step 8: Monitor progress through all stages
    console.log('\nStep 8: Monitoring analysis progress...');
    console.log('  This will take 30-90 minutes. Progress updates will appear below.\n');

    let lastScreenshotTime = Date.now();
    let currentStage = '';
    let stageStartTime = Date.now();

    await browser.waitForFullAnalysisComplete({
      timeout: CONFIG.fullAnalysisTimeout,
      pollInterval: CONFIG.pollInterval,
      verbose: false, // We'll handle our own logging
      onProgress: (update) => {
        if (update.type === 'stage_change') {
          // Record timing for previous stage
          if (currentStage && currentStage !== 'unknown') {
            const stageDuration = Date.now() - stageStartTime;
            stageTimings[currentStage] = stageDuration;
            console.log(`  ✓ ${currentStage} completed in ${formatDuration(stageDuration)}`);
          }

          // New stage
          currentStage = update.stage;
          stageStartTime = Date.now();
          console.log(`\n→ Stage: ${update.stage.toUpperCase()}`);

          if (update.progress.total > 0) {
            console.log(`  Progress: 0 / ${update.progress.total}`);
          }
        } else if (update.type === 'progress_update') {
          if (update.progress.total > 0) {
            const percentage = Math.round((update.progress.current / update.progress.total) * 100);
            console.log(
              `  Progress: ${update.progress.current} / ${update.progress.total} (${percentage}%)`
            );
          }
        } else if (update.type === 'paused') {
          console.log(`  ⏸  Analysis paused (stage: ${update.stage})`);
        }
      },
    });

    // Record final stage timing
    if (currentStage) {
      const stageDuration = Date.now() - stageStartTime;
      stageTimings[currentStage] = stageDuration;
      console.log(`  ✓ ${currentStage} completed in ${formatDuration(stageDuration)}`);
    }

    const totalDuration = Date.now() - totalStartTime;
    console.log(`\n✓ Full analysis completed in ${formatDuration(totalDuration)}`);

    // Take periodic screenshots during long-running analysis
    if (Date.now() - lastScreenshotTime > CONFIG.screenshotInterval) {
      screenshotCount++;
      await browser.takeScreenshot(
        path.join(CONFIG.screenshotDir, `full-progress-${screenshotCount}.png`),
        { fullPage: true }
      );
      lastScreenshotTime = Date.now();
    }

    // Step 9: Take final screenshot
    console.log('\nStep 9: Capturing completion state...');
    await browser.takeScreenshot(path.join(CONFIG.screenshotDir, 'full-complete.png'), {
      fullPage: true,
    });
    log('Screenshot captured: full-complete.png');

    // Step 10: Download report (if not already downloaded)
    console.log('\nStep 10: Downloading report...');

    // Wait a moment for automatic download
    await browser.getPage().waitForTimeout(3000);

    if (!autoDownloadCaptured) {
      const hasReport = await browser.isReportAvailable();
      if (!hasReport) {
        throw new Error('Report not available for download');
      }
      downloadedFile = await browser.downloadReport(CONFIG.downloadDir);
      log(`Report downloaded manually: ${downloadedFile}`);
    } else {
      log(`Report downloaded automatically: ${downloadedFile}`);
    }

    // Step 11: Verify report contents
    console.log('\nStep 11: Verifying report contents...');
    const verification = await verifyReport(downloadedFile);

    if (!verification.passed) {
      console.log('  Report verification details:');
      console.log(`    - Has title: ${verification.checks.hasTitle}`);
      console.log(`    - Has metadata: ${verification.checks.hasMetadata}`);
      console.log(`    - Has papers: ${verification.checks.hasPapers}`);
      console.log(`    - Has scores: ${verification.checks.hasScores}`);
      console.log(`    - Has categories: ${verification.checks.hasCategories}`);
      console.log(`    - Has analysis: ${verification.checks.hasAnalysis}`);
      console.log(
        `    - Has content: ${verification.checks.hasContent} (${verification.size} bytes)`
      );
      throw new Error('Report verification failed');
    }

    log(`Report verified (${verification.size} bytes, ${Math.round(verification.size / 1024)} KB)`);

    // Step 12: Generate NotebookLM document (optional)
    let notebookLMFile = null;
    if (CONFIG.generateNotebookLM) {
      console.log('\nStep 12: Generating NotebookLM document...');
      console.log('  Note: Using duration and model settings from UI configuration');

      try {
        // Check if NotebookLM generation is available
        const isAvailable = await browser.isNotebookLMAvailable();
        if (!isAvailable) {
          console.log(
            '  ⚠ NotebookLM generation not available (no papers analyzed or feature disabled)'
          );
        } else {
          // Start generation
          await browser.generateNotebookLM();
          log('NotebookLM generation started');

          // Wait for completion
          const notebookLMStartTime = Date.now();
          await browser.waitForNotebookLMComplete({
            timeout: CONFIG.notebookLMTimeout,
            pollInterval: 2000,
          });
          const notebookLMDuration = Date.now() - notebookLMStartTime;
          log(`NotebookLM generation completed in ${formatDuration(notebookLMDuration)}`);

          // Download the NotebookLM document
          notebookLMFile = await browser.downloadNotebookLM(CONFIG.downloadDir);
          log(`NotebookLM document downloaded: ${notebookLMFile}`);

          // Take screenshot of NotebookLM completion
          await browser.takeScreenshot(path.join(CONFIG.screenshotDir, 'notebooklm-complete.png'), {
            fullPage: true,
          });
          log('Screenshot captured: notebooklm-complete.png');
        }
      } catch (error) {
        console.log(`  ⚠ NotebookLM generation failed: ${error.message}`);
        console.log('  Continuing with analysis report only...');
      }
    } else {
      console.log('\nStep 12: Skipping NotebookLM generation (--skip-notebooklm flag set)');
    }

    // Step 13: Upload to NotebookLM and generate podcast (optional)
    let podcastFile = null;
    if (CONFIG.generatePodcast && notebookLMFile) {
      console.log('\nStep 13: Uploading to NotebookLM and generating podcast...');
      console.log('  Note: This requires Google authentication and may take 10-20 minutes');

      const notebookLM = new NotebookLMAutomation();

      try {
        // Launch browser
        console.log('  Launching browser for NotebookLM...');
        await notebookLM.launch({ headless: false });
        log('NotebookLM browser launched');

        // Authenticate with Google (interactive on first run)
        await notebookLM.ensureAuthenticated({ timeout: 120000 });
        log('Authenticated with Google');

        // Extract date prefix from report filename for consistent naming
        const reportBasename = path.basename(downloadedFile);
        const dateMatch = reportBasename.match(/^(\d{4}-\d{2}-\d{2})/);
        const datePrefix = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
        const notebookName = `${datePrefix}_aparture`;

        // Create notebook
        console.log(`  Creating notebook: ${notebookName}...`);
        await notebookLM.createNotebook(notebookName);
        log(`Notebook created: ${notebookName}`);

        // Take screenshot after notebook creation
        await notebookLM.takeScreenshot(
          path.join(CONFIG.screenshotDir, 'notebooklm-notebook-created.png')
        );

        // Upload files
        console.log('  Uploading report and NotebookLM document...');
        await notebookLM.uploadFiles(downloadedFile, notebookLMFile);
        log('Files uploaded successfully');

        // Take screenshot after file upload
        await notebookLM.takeScreenshot(
          path.join(CONFIG.screenshotDir, 'notebooklm-files-uploaded.png')
        );

        // Extract duration and get appropriate prompt
        const duration = extractDurationFromFilename(notebookLMFile);
        console.log(`  Podcast duration target: ${duration}`);

        const customPrompt = await getPromptForFile(notebookLMFile);
        console.log(
          `  Custom prompt loaded from NOTEBOOKLM_PROMPTS.md (${customPrompt.length} characters)`
        );

        // Generate audio overview with customization
        console.log('  Configuring audio overview (Deep Dive, Default length)...');
        await notebookLM.generateAudioOverview(customPrompt, duration);
        log('Audio generation started');

        // Take screenshot of customization dialog (captured during generateAudioOverview)
        log('Screenshot captured: notebooklm-customization-dialog.png');

        // Take screenshot of generation start
        await notebookLM.takeScreenshot(
          path.join(CONFIG.screenshotDir, 'notebooklm-generation-started.png')
        );

        // Wait for generation to complete
        console.log('  Waiting for podcast generation...');
        console.log('  This typically takes 10-20 minutes. Progress updates will appear below.');
        const podcastStartTime = Date.now();
        await notebookLM.waitForAudioGeneration({
          timeout: CONFIG.podcastGenerationTimeout,
        });
        const podcastDuration = Date.now() - podcastStartTime;
        log(`Podcast generation completed in ${formatDuration(podcastDuration)}`);

        // Take screenshot of completion
        await notebookLM.takeScreenshot(
          path.join(CONFIG.screenshotDir, 'notebooklm-generation-complete.png')
        );

        // Download podcast
        const podcastFileName = `${datePrefix}_podcast.m4a`;
        console.log(`  Downloading podcast: ${podcastFileName}...`);
        podcastFile = await notebookLM.downloadAudio(CONFIG.downloadDir, podcastFileName);
        log(`Podcast downloaded: ${podcastFile}`);

        // Verify file was downloaded
        const podcastStats = await fs.stat(podcastFile);
        const podcastSizeMB = (podcastStats.size / (1024 * 1024)).toFixed(2);
        log(`Podcast file size: ${podcastSizeMB} MB`);

        // Keep browser open briefly for inspection
        console.log('  Keeping browser open for 5 seconds for inspection...');
        await notebookLM.getPage().waitForTimeout(5000);

        // Close NotebookLM browser
        await notebookLM.close();
        log('NotebookLM browser closed');
      } catch (error) {
        console.log(`  ⚠ Podcast generation failed: ${error.message}`);
        console.log('  You can manually upload the files to NotebookLM to generate the podcast');

        // Take error screenshot
        try {
          await notebookLM.takeScreenshot(path.join(CONFIG.screenshotDir, 'notebooklm-error.png'));
        } catch {
          // Ignore screenshot errors
        }

        // Close browser on error
        try {
          await notebookLM.close();
        } catch {
          // Ignore close errors
        }
      }
    } else if (CONFIG.generatePodcast && !notebookLMFile) {
      console.log('\nStep 13: Skipping podcast generation (no NotebookLM document available)');
      console.log('  Tip: Remove --skip-notebooklm flag to generate podcast');
    } else {
      console.log('\nStep 13: Skipping podcast generation (--skip-podcast flag set)');
    }

    // Success!
    console.log('\n' + '='.repeat(70));
    console.log('✓ Analysis Complete!');
    console.log('='.repeat(70));

    // Print timing summary
    console.log('\n=== Timing Summary ===');
    console.log(`Total runtime: ${formatDuration(totalDuration)}`);
    console.log('\nStage breakdown:');
    for (const [stage, duration] of Object.entries(stageTimings)) {
      const percentage = Math.round((duration / totalDuration) * 100);
      console.log(`  ${stage}: ${formatDuration(duration)} (${percentage}%)`);
    }

    console.log('\n=== Summary ===');
    console.log('Completed:');
    console.log('  ✓ Full production analysis workflow');
    console.log(
      '  ✓ Multi-stage processing (fetching → filtering → scoring → post-processing → pdf-analysis)'
    );
    console.log('  ✓ Progress monitoring through all stages');
    console.log('  ✓ Comprehensive report generation');
    console.log('  ✓ Report downloaded and verified');
    if (notebookLMFile) {
      console.log('  ✓ NotebookLM document generated and downloaded');
    }
    if (podcastFile) {
      console.log('  ✓ Podcast generated via NotebookLM and downloaded');
    }
    console.log(`\nReport saved to: ${downloadedFile}`);
    if (notebookLMFile) {
      console.log(`NotebookLM document saved to: ${notebookLMFile}`);
    }
    if (podcastFile) {
      console.log(`Podcast saved to: ${podcastFile}`);
    }
    console.log('');
  } catch (error) {
    console.error('\n✗ Analysis failed:', error.message);

    // Take error screenshot
    try {
      await browser.takeScreenshot(path.join(CONFIG.screenshotDir, 'full-error.png'), {
        fullPage: true,
      });
      console.error('Error screenshot saved: full-error.png');
    } catch {
      // Ignore screenshot errors
    }

    // Print timing summary even on failure
    if (totalStartTime) {
      const totalDuration = Date.now() - totalStartTime;
      console.error(`\nFailed after ${formatDuration(totalDuration)}`);

      if (Object.keys(stageTimings).length > 0) {
        console.error('\nCompleted stages before failure:');
        for (const [stage, duration] of Object.entries(stageTimings)) {
          console.error(`  ${stage}: ${formatDuration(duration)}`);
        }
      }
    }

    console.error('');
    process.exit(1);
  } finally {
    // Cleanup
    console.log('Cleaning up...');

    // Don't close browser immediately so user can see final state
    if (!CONFIG.headless) {
      console.log('Browser will remain open for 10 seconds for inspection...');
      await browser.getPage()?.waitForTimeout(10000);
    }

    await browser.close();
    log('Browser closed');

    // Only stop server if we started it
    if (serverStartedByTest) {
      await server.stop();
    } else {
      console.log('✓ Leaving existing server running');
    }
  }
}

// Run appropriate workflow based on flags
if (require.main === module) {
  if (podcastOnly) {
    runPodcastOnly().catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  } else {
    runAnalysis().catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}

module.exports = { runAnalysis, runPodcastOnly };
