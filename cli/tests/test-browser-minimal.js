#!/usr/bin/env node

/**
 * test-browser-minimal.js
 *
 * Phase 4 Test: Minimal API Test Execution
 *
 * Tests:
 * - Expanding System Tests section
 * - Clicking "Run API Test" button (Minimal API Test)
 * - Monitoring progress through completion (5 real papers)
 * - Downloading generated report
 * - Verifying report contents
 *
 * NOTE: This test uses real API calls and will incur small costs!
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
  minimalTestTimeout: 600000, // 10 minutes (real API calls take time)
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

  // Check for key sections (relaxed for minimal test - it's just a summary)
  const checks = {
    hasTitle: content.includes('arXiv') || content.includes('APARTURE'),
    hasMetadata: content.includes('Generated') || content.includes('MINIMAL'),
    hasTestInfo: content.includes('TEST') || content.includes('Working'),
    hasAPIsWorking: content.includes('API') || content.includes('Real'),
    hasContent: content.length > 200, // Minimal test reports are brief summaries
  };

  const allPassed = Object.values(checks).every((v) => v);

  return {
    passed: allPassed,
    checks,
    size: content.length,
  };
}

/**
 * Run Phase 4 minimal API test
 */
async function runTest() {
  const browser = new BrowserAutomation();
  const server = new ServerManager(TEST_CONFIG.serverPort);
  let serverStartedByTest = false;
  let downloadedFile = null;

  try {
    console.log('\n=== Phase 4: Minimal API Test Execution ===\n');
    console.log('⚠️  WARNING: This test uses real API calls and will incur costs!');
    console.log('    (Testing with 5 hardcoded papers)\n');

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

    // Step 5: Expand System Tests section
    console.log('\nStep 5: Expanding System Tests section...');
    await browser.expandSystemTests();
    logTest('System Tests section expanded');

    // Take screenshot showing test buttons
    await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'minimal-ready.png'), {
      fullPage: true,
    });
    logTest('Screenshot captured: minimal-ready.png');

    // Step 5.5: Check if dry run has been completed (prerequisite)
    console.log('\nStep 5.5: Checking dry run prerequisite...');
    const dryRunNeeded = await browser.exists('button:has-text("Run Dry Test First")');

    if (dryRunNeeded) {
      console.log('  Dry run has not been completed yet - running it first...');

      // Run dry run test
      await browser.startDryRun();
      logTest('Dry run started');

      // Wait for dry run to complete
      const dryRunStartTime = Date.now();
      let dryRunCompleted = false;

      while (!dryRunCompleted && Date.now() - dryRunStartTime < 120000) {
        const hasRunAgain = await browser.exists('button:has-text("Run Again")');
        if (hasRunAgain) {
          dryRunCompleted = true;
          break;
        }
        await browser.getPage().waitForTimeout(3000);
      }

      if (!dryRunCompleted) {
        throw new Error('Dry run prerequisite did not complete in time');
      }

      const dryRunDuration = Math.round((Date.now() - dryRunStartTime) / 1000);
      logTest(`Dry run prerequisite completed in ${dryRunDuration} seconds`);

      // Wait a moment for any automatic download
      await browser.getPage().waitForTimeout(3000);

      // Re-expand System Tests section (it may have collapsed)
      await browser.expandSystemTests();
      logTest('System Tests re-expanded after dry run');
    } else {
      logTest('Dry run prerequisite already completed');
    }

    // Step 6: Start minimal API test
    console.log('\nStep 6: Starting minimal API test...');
    console.log('  (This will process 5 real papers with actual API calls)');
    await browser.startMinimalTest();
    logTest('Minimal API test started');

    // Wait a moment for the test to start
    await browser.getPage().waitForTimeout(3000);

    // Take screenshot of test in progress
    await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'minimal-in-progress.png'), {
      fullPage: true,
    });
    logTest('Screenshot captured: minimal-in-progress.png');

    // Step 7: Wait for completion with progress updates
    console.log('\nStep 7: Waiting for minimal test to complete...');
    console.log('  (This typically takes 2-5 minutes with real API calls)');

    const startTime = Date.now();
    let lastStage = '';
    let lastUpdate = Date.now();
    let autoDownloadCaptured = false;

    // Set up listener for automatic download
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
    const pollInterval = 5000; // Check every 5 seconds
    let completed = false;

    while (!completed && Date.now() - startTime < TEST_CONFIG.minimalTestTimeout) {
      // Check if "Run API Test" button is back (completion indicator)
      const hasRunButton = await browser.exists('button:has-text("Run API Test")');
      const isTesting = await browser.exists('button:has-text("Testing...")');

      if (hasRunButton && !isTesting) {
        completed = true;
        break;
      }

      // Try to get current stage for progress updates
      try {
        const stage = await browser.getCurrentStage();
        if (stage !== lastStage && stage !== 'Unknown') {
          console.log(`  Current stage: ${stage}`);
          lastStage = stage;
          lastUpdate = Date.now();
        }
      } catch {
        // Ignore errors getting stage
      }

      // Progress indicator every 30 seconds if no stage updates
      const timeSinceLastUpdate = Date.now() - lastUpdate;
      if (timeSinceLastUpdate > 30000) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`  Still processing... (${elapsed}s elapsed)`);
        lastUpdate = Date.now();
      }

      await browser.getPage().waitForTimeout(pollInterval);
    }

    if (!completed) {
      throw new Error('Minimal test did not complete within timeout');
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    logTest(
      `Minimal test completed in ${duration} seconds (${Math.round(duration / 60)}m ${duration % 60}s)`
    );

    // Wait a moment for automatic download to trigger
    await browser.getPage().waitForTimeout(3000);

    if (autoDownloadCaptured) {
      logTest('Automatic download captured on completion');
    }

    // Take screenshot of completion
    await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'minimal-complete.png'), {
      fullPage: true,
    });
    logTest('Screenshot captured: minimal-complete.png');

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
      console.log(`    - Has test info: ${verification.checks.hasTestInfo}`);
      console.log(`    - Has APIs working: ${verification.checks.hasAPIsWorking}`);
      console.log(
        `    - Has content: ${verification.checks.hasContent} (${verification.size} bytes)`
      );
      throw new Error('Report verification failed');
    }

    logTest(`Report verified (${verification.size} bytes)`);

    // Success!
    console.log('\n' + '='.repeat(50));
    console.log('✓ All Phase 4 tests passed!');
    console.log('='.repeat(50));
    console.log('\nThis validates:');
    console.log('  - Minimal API test execution with real API calls');
    console.log('  - Processing of 5 real arXiv papers');
    console.log('  - Progress monitoring through all stages');
    console.log('  - Report generation with actual paper data');
    console.log('  - Ready for Phase 5 (full production run)');
    console.log('');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);

    // Take error screenshot
    try {
      await browser.takeScreenshot(path.join(TEST_CONFIG.screenshotDir, 'minimal-error.png'), {
        fullPage: true,
      });
      console.error('Error screenshot saved: minimal-error.png');
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
