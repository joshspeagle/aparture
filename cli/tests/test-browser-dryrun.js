#!/usr/bin/env node

/**
 * test-browser-dryrun.js
 *
 * Phase 3 Test: Dry Run Execution
 *
 * Tests:
 * - Expanding System Tests section
 * - Clicking "Run Dry Test" button
 * - Monitoring progress through completion
 * - Downloading generated report
 * - Verifying report contents
 */

const BrowserAutomation = require('./browser-automation');
const { ServerManager } = require('./server-manager');
const path = require('path');
const fs = require('fs').promises;

// Test configuration
const TEST_CONFIG = {
  serverPort: 3000,
  screenshotDir: path.join(__dirname, '../reports/test-screenshots'),
  downloadDir: path.join(__dirname, '../reports'),
  headless: false, // Set to false for visibility during testing
  envFile: path.join(__dirname, '../.env.local'),
  dryRunTimeout: 120000, // 2 minutes (dry runs are usually fast)
};

/**
 * Print test result
 */
function logTest(message, passed = true) {
  const icon = passed ? '✓' : '✗';
  console.log(`${icon} ${message}`);
}

/**
 * Read password from .env.local
 */
async function readPassword() {
  try {
    const envContent = await fs.readFile(TEST_CONFIG.envFile, 'utf-8');
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
 * Verify report file contents
 */
async function verifyReport(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

  // Check for key sections
  const checks = {
    hasTitle: content.includes('# arXiv Analysis Report') || content.includes('arXiv'),
    hasMetadata: content.includes('Generated') || content.includes('TEST MODE'),
    hasPapers: content.includes('Paper') || content.includes('Abstract'),
    hasContent: content.length > 1000, // Should be substantial
  };

  const allPassed = Object.values(checks).every((v) => v);

  return {
    passed: allPassed,
    checks,
    size: content.length,
  };
}

/**
 * Run Phase 3 dry run test
 */
async function runTest() {
  const browser = new BrowserAutomation();
  const server = new ServerManager(TEST_CONFIG.serverPort);
  let serverStartedByTest = false;
  let downloadedFile = null;

  try {
    console.log('\n=== Phase 3: Dry Run Execution ===\n');

    // Step 1: Get password
    console.log('Step 1: Reading password from .env.local...');
    const password = await readPassword();
    logTest(`Password loaded: ${password.substring(0, 4)}****`);

    // Step 2: Ensure server is running
    console.log('\nStep 2: Checking server status...');
    const serverInfo = await server.ensure();
    serverStartedByTest = serverInfo.started === true;
    logTest(`Server running at ${server.getBaseUrl()}`);

    // Step 3: Launch browser (visible mode for this test)
    console.log('\nStep 3: Launching browser...');
    await browser.launch(TEST_CONFIG.headless);
    logTest('Browser launched');

    // Step 4: Navigate and authenticate
    console.log('\nStep 4: Navigating and authenticating...');
    await browser.navigate(server.getBaseUrl());
    await browser.authenticate(password);
    logTest('Authenticated successfully');

    // Take screenshot of main UI
    await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'dryrun-ready.png'), {
      fullPage: true,
    });
    logTest('Screenshot captured: dryrun-ready.png');

    // Step 5: Expand System Tests section
    console.log('\nStep 5: Expanding System Tests section...');
    await browser.expandSystemTests();
    logTest('System Tests section expanded');

    // Take screenshot showing test buttons
    await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'dryrun-tests-visible.png'), {
      fullPage: true,
    });
    logTest('Screenshot captured: dryrun-tests-visible.png');

    // Step 6: Start dry run
    console.log('\nStep 6: Starting dry run test...');
    await browser.startDryRun();
    logTest('Dry run test started');

    // Wait a moment for the test to start
    await browser.getPage().waitForTimeout(2000);

    // Take screenshot of test in progress
    await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'dryrun-in-progress.png'), {
      fullPage: true,
    });
    logTest('Screenshot captured: dryrun-in-progress.png');

    // Step 7: Wait for completion with progress updates
    console.log('\nStep 7: Waiting for dry run to complete...');
    console.log('  (This typically takes 30-60 seconds)');

    const startTime = Date.now();
    let lastStage = '';
    let autoDownloadCaptured = false;

    // Set up listener for automatic download that happens on completion
    browser.getPage().on('download', async (download) => {
      try {
        const fileName = download.suggestedFilename();
        const filePath = `${TEST_CONFIG.downloadDir}/${fileName}`;
        await download.saveAs(filePath);
        console.log(`  Automatic download captured: ${fileName}`);
        downloadedFile = filePath;
        autoDownloadCaptured = true;
      } catch (err) {
        console.log(`  Note: Automatic download encountered issue: ${err.message}`);
      }
    });

    // Poll for completion
    const pollInterval = 3000; // Check every 3 seconds
    let completed = false;

    while (!completed && Date.now() - startTime < TEST_CONFIG.dryRunTimeout) {
      // Check for "Run Again" button (completion indicator)
      const hasRunAgain = await browser.exists('button:has-text("Run Again")');
      if (hasRunAgain) {
        completed = true;
        break;
      }

      // Try to get current stage for progress updates
      try {
        const stage = await browser.getCurrentStage();
        if (stage !== lastStage && stage !== 'Unknown') {
          console.log(`  Current stage: ${stage}`);
          lastStage = stage;
        }
      } catch {
        // Ignore errors getting stage
      }

      await browser.getPage().waitForTimeout(pollInterval);
    }

    if (!completed) {
      throw new Error('Dry run did not complete within timeout');
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    logTest(`Dry run completed in ${duration} seconds`);

    // Wait a moment for automatic download to trigger (if it does)
    await browser.getPage().waitForTimeout(3000);

    if (autoDownloadCaptured) {
      logTest('Automatic download captured on completion');
    }

    // Take screenshot of completion
    await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'dryrun-complete.png'), {
      fullPage: true,
    });
    logTest('Screenshot captured: dryrun-complete.png');

    // Step 8: Check if report is available (manual download button)
    console.log('\nStep 8: Checking for report download button...');
    const hasReport = await browser.isReportAvailable();

    // Step 9: Download report (if not already downloaded automatically)
    if (!autoDownloadCaptured) {
      console.log('\nStep 9: Downloading report manually...');
      if (!hasReport) {
        throw new Error('Report not available for download (neither automatic nor manual)');
      }
      downloadedFile = await browser.downloadReport(TEST_CONFIG.downloadDir);
      logTest(`Report downloaded manually: ${downloadedFile}`);
    } else {
      console.log('\nStep 9: Report already downloaded automatically');
      logTest(`Using automatic download: ${downloadedFile}`);
    }

    // Step 10: Verify report contents
    console.log('\nStep 10: Verifying report contents...');
    const verification = await verifyReport(downloadedFile);

    if (!verification.passed) {
      console.log('  Report verification details:');
      console.log(`    - Has title: ${verification.checks.hasTitle}`);
      console.log(`    - Has metadata: ${verification.checks.hasMetadata}`);
      console.log(`    - Has papers: ${verification.checks.hasPapers}`);
      console.log(
        `    - Has content: ${verification.checks.hasContent} (${verification.size} bytes)`
      );
      throw new Error('Report verification failed');
    }

    logTest(`Report verified (${verification.size} bytes)`);

    // Success!
    console.log('\n' + '='.repeat(50));
    console.log('✓ All Phase 3 tests passed!');
    console.log('='.repeat(50));
    console.log('\nThis validates:');
    console.log('  - System Tests section expansion');
    console.log('  - Dry run test execution');
    console.log('  - Progress monitoring');
    console.log('  - Report generation and download');
    console.log('  - Ready for Phase 4 (minimal API test)');
    console.log('');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);

    // Take error screenshot
    try {
      await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'dryrun-error.png'), {
        fullPage: true,
      });
      console.error('Error screenshot saved: dryrun-error.png');
    } catch {
      // Ignore screenshot errors
    }

    console.error('');
    process.exit(1);
  } finally {
    // Cleanup
    console.log('Cleaning up...');

    // Don't close browser immediately so user can see final state
    if (!TEST_CONFIG.headless) {
      console.log('Browser will remain open for 5 seconds for inspection...');
      await browser.getPage()?.waitForTimeout(5000);
    }

    await browser.close();
    logTest('Browser closed');

    // Only stop server if we started it
    if (serverStartedByTest) {
      await server.stop();
    } else {
      console.log('✓ Leaving existing server running');
    }
  }
}

// Run test
if (require.main === module) {
  runTest().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTest };
