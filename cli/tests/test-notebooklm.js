#!/usr/bin/env node

/**
 * test-notebooklm.js
 *
 * Test NotebookLM automation in isolation using existing report files.
 * This tests the Google authentication, file upload, customization, and podcast generation
 * without running a full analysis.
 *
 * Usage:
 *   node cli/tests/test-notebooklm.js
 *
 * Requirements:
 *   - Existing report and NotebookLM document files in reports/
 *   - Google account for NotebookLM authentication
 *
 * What this tests:
 *   1. NotebookLM browser launch and Google authentication
 *   2. Notebook creation with date_aparture naming
 *   3. File upload (report + NotebookLM document)
 *   4. Customization menu navigation
 *   5. Audio overview generation with custom prompts
 *   6. Podcast download
 */

const NotebookLMAutomation = require('../notebooklm-automation');
const { getPromptForFile, extractDurationFromFilename } = require('../notebooklm-prompts');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const CONFIG = {
  reportsDir: path.join(__dirname, '../../reports'),
  screenshotDir: path.join(__dirname, '../../reports/screenshots'),
  // Use the most recent files from today (2025-10-13)
  reportFile: '2025-10-13_arxiv_analysis_63min.md',
  notebooklmFile: '2025-10-13_notebooklm_30min.md',
  podcastGenerationTimeout: 1800000 // 30 minutes
};

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Log status message
 */
function log(message, passed = true) {
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${message}`);
}

/**
 * Main test function
 */
async function runTest() {
  console.log('\n=== NotebookLM Automation Test ===\n');
  console.log('This test will:');
  console.log('  1. Launch browser and authenticate with Google');
  console.log('  2. Create a new NotebookLM notebook');
  console.log('  3. Upload existing report and NotebookLM document');
  console.log('  4. Configure audio overview customization');
  console.log('  5. Generate podcast with custom prompt');
  console.log('  6. Download generated podcast');
  console.log('');
  console.log('⚠️  This requires Google authentication and takes 10-20 minutes');
  console.log('');

  const notebookLM = new NotebookLMAutomation();
  let podcastFile = null;

  try {
    // Verify test files exist
    console.log('Step 1: Verifying test files...');
    const reportPath = path.join(CONFIG.reportsDir, CONFIG.reportFile);
    const notebooklmPath = path.join(CONFIG.reportsDir, CONFIG.notebooklmFile);

    try {
      await fs.access(reportPath);
      log(`Report file found: ${CONFIG.reportFile}`);
    } catch (error) {
      throw new Error(`Report file not found: ${reportPath}`);
    }

    try {
      await fs.access(notebooklmPath);
      log(`NotebookLM document found: ${CONFIG.notebooklmFile}`);
    } catch (error) {
      throw new Error(`NotebookLM document not found: ${notebooklmPath}`);
    }

    // Extract date prefix for naming
    const dateMatch = CONFIG.reportFile.match(/^(\d{4}-\d{2}-\d{2})/);
    const datePrefix = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    const notebookName = `${datePrefix}_aparture_test`;
    log(`Notebook name: ${notebookName}`);

    // Extract duration and load prompt
    const duration = extractDurationFromFilename(CONFIG.notebooklmFile);
    log(`Detected podcast duration: ${duration}`);

    const customPrompt = await getPromptForFile(notebooklmPath);
    log(`Custom prompt loaded (${customPrompt.length} characters)`);

    // Step 2: Launch browser
    console.log('\nStep 2: Launching NotebookLM browser...');
    console.log('  Note: Browser will remain visible for monitoring');
    await notebookLM.launch({ headless: false });
    log('Browser launched');

    // Step 3: Authenticate
    console.log('\nStep 3: Authenticating with Google...');
    console.log('  If not logged in, please complete authentication in the browser');
    const authStartTime = Date.now();
    await notebookLM.ensureAuthenticated({ timeout: 120000 });
    const authDuration = Date.now() - authStartTime;
    log(`Authenticated in ${formatDuration(authDuration)}`);

    // Take screenshot after auth
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'test-notebooklm-authenticated.png')
    );
    log('Screenshot: test-notebooklm-authenticated.png');

    // Step 4: Create notebook
    console.log('\nStep 4: Creating notebook...');
    await notebookLM.createNotebook(notebookName);
    log(`Notebook created: ${notebookName}`);

    // Take screenshot after notebook creation
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'test-notebooklm-notebook-created.png')
    );
    log('Screenshot: test-notebooklm-notebook-created.png');

    // Step 5: Upload files
    console.log('\nStep 5: Uploading files...');
    console.log(`  Report: ${CONFIG.reportFile}`);
    console.log(`  NotebookLM doc: ${CONFIG.notebooklmFile}`);
    await notebookLM.uploadFiles(reportPath, notebooklmPath);
    log('Files uploaded successfully');

    // Take screenshot after upload
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'test-notebooklm-files-uploaded.png')
    );
    log('Screenshot: test-notebooklm-files-uploaded.png');

    // Step 6: Generate audio overview
    console.log('\nStep 6: Configuring and generating audio overview...');
    console.log(`  Format: Deep Dive`);
    console.log(`  Length: Default`);
    console.log(`  Duration target: ${duration}`);
    console.log(`  Custom prompt: ${customPrompt.substring(0, 100)}...`);

    await notebookLM.generateAudioOverview(customPrompt, duration);
    log('Audio generation started');

    // Take screenshot of generation start
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'test-notebooklm-generation-started.png')
    );
    log('Screenshot: test-notebooklm-generation-started.png');

    // Step 7: Wait for generation
    console.log('\nStep 7: Waiting for podcast generation...');
    console.log('  This typically takes 10-20 minutes');
    console.log('  Progress updates will be shown every 30 seconds');

    const generationStartTime = Date.now();
    await notebookLM.waitForAudioGeneration({
      timeout: CONFIG.podcastGenerationTimeout
    });
    const generationDuration = Date.now() - generationStartTime;
    log(`Podcast generated in ${formatDuration(generationDuration)}`);

    // Take screenshot of completion
    await notebookLM.takeScreenshot(
      path.join(CONFIG.screenshotDir, 'test-notebooklm-generation-complete.png')
    );
    log('Screenshot: test-notebooklm-generation-complete.png');

    // Step 8: Download podcast
    console.log('\nStep 8: Downloading podcast...');
    const podcastFileName = `${datePrefix}_podcast_test.m4a`;
    podcastFile = await notebookLM.downloadAudio(CONFIG.reportsDir, podcastFileName);
    log(`Podcast downloaded: ${podcastFileName}`);

    // Verify file exists and has content
    const stats = await fs.stat(podcastFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    log(`File size: ${fileSizeMB} MB`);

    // Success!
    console.log('\n' + '='.repeat(70));
    console.log('✓ NotebookLM Automation Test PASSED');
    console.log('='.repeat(70));
    console.log('\nTest Summary:');
    console.log(`  ✓ Authentication: ${formatDuration(authDuration)}`);
    console.log(`  ✓ Notebook created: ${notebookName}`);
    console.log(`  ✓ Files uploaded: 2 files`);
    console.log(`  ✓ Podcast generated: ${formatDuration(generationDuration)}`);
    console.log(`  ✓ Podcast downloaded: ${podcastFileName} (${fileSizeMB} MB)`);
    console.log('');
    console.log('Output files:');
    console.log(`  Podcast: ${podcastFile}`);
    console.log(`  Screenshots: ${CONFIG.screenshotDir}/test-notebooklm-*.png`);
    console.log('');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('✗ NotebookLM Automation Test FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${error.message}`);
    console.error('');

    // Take error screenshot
    try {
      await notebookLM.takeScreenshot(
        path.join(CONFIG.screenshotDir, 'test-notebooklm-error.png')
      );
      console.error('Error screenshot saved: test-notebooklm-error.png');
    } catch (screenshotError) {
      // Ignore screenshot errors
    }

    console.error('\nTroubleshooting tips:');
    console.error('  - Check that you are logged in to Google in the browser');
    console.error('  - Verify NotebookLM is accessible at https://notebooklm.google.com');
    console.error('  - Check screenshots in reports/screenshots/ for UI state');
    console.error('  - NotebookLM UI may have changed - selectors may need updating');
    console.error('');

    process.exit(1);

  } finally {
    // Close browser
    console.log('Cleaning up...');
    try {
      await notebookLM.close();
      log('Browser closed');
    } catch (closeError) {
      console.error('  ⚠ Failed to close browser:', closeError.message);
    }
  }
}

// Run test
runTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
