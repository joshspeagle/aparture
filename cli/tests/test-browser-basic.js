#!/usr/bin/env node

/**
 * test-browser-basic.js
 *
 * Phase 1 Test: Basic Browser Launch & Navigation
 *
 * Tests:
 * - Server detection/startup
 * - Browser launch with Playwright
 * - Navigation to Aparture UI
 * - Password prompt detection
 * - Screenshot capture
 * - Page title verification
 */

const BrowserAutomation = require('./browser-automation');
const { ServerManager } = require('./server-manager');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  serverPort: 3000,
  screenshotPath: path.join(__dirname, '../reports/test-screenshots/basic-nav.png'),
  expectedTitle: 'aparture',
  passwordPromptSelector: 'input[type="password"]',
  headless: true, // Set to false for debugging
};

/**
 * Print test result
 */
function logTest(message, passed = true) {
  const icon = passed ? '✓' : '✗';
  console.log(`${icon} ${message}`);
}

/**
 * Run Phase 1 basic browser test
 */
async function runTest() {
  const browser = new BrowserAutomation();
  const server = new ServerManager(TEST_CONFIG.serverPort);
  let serverStartedByTest = false;

  try {
    console.log('\n=== Phase 1: Basic Browser Launch & Navigation ===\n');

    // Step 1: Ensure server is running
    console.log('Step 1: Checking server status...');
    const serverInfo = await server.ensure();
    serverStartedByTest = serverInfo.started === true;
    logTest(`Server running at ${server.getBaseUrl()}`);

    // Step 2: Launch browser
    console.log('\nStep 2: Launching browser...');
    await browser.launch(TEST_CONFIG.headless);
    logTest('Browser launched');

    // Step 3: Navigate to Aparture
    console.log('\nStep 3: Navigating to Aparture...');
    await browser.navigate(server.getBaseUrl());
    logTest('Navigated to Aparture');

    // Step 4: Wait for password prompt
    console.log('\nStep 4: Looking for password prompt...');
    await browser.waitForSelector(TEST_CONFIG.passwordPromptSelector, { timeout: 15000 });
    logTest('Password prompt found');

    // Step 5: Take screenshot
    console.log('\nStep 5: Capturing screenshot...');
    await browser.takeScreenshot(TEST_CONFIG.screenshotPath, { fullPage: true });
    logTest(`Screenshot saved: ${TEST_CONFIG.screenshotPath}`);

    // Step 6: Verify page title
    console.log('\nStep 6: Verifying page title...');
    const title = await browser.getTitle();
    const titleMatches = title.toLowerCase().includes(TEST_CONFIG.expectedTitle.toLowerCase());

    if (!titleMatches) {
      throw new Error(`Title mismatch: expected "${TEST_CONFIG.expectedTitle}", got "${title}"`);
    }
    logTest(`Page title verified: "${title}"`);

    // Success!
    console.log('\n' + '='.repeat(50));
    console.log('✓ All Phase 1 tests passed!');
    console.log('='.repeat(50));
    console.log('\nThis validates:');
    console.log('  - Playwright is installed and working');
    console.log('  - Server manager integration works');
    console.log('  - We can programmatically access the UI');
    console.log('  - Basic page elements are present');
    console.log('  - Ready for Phase 2 (authentication)');
    console.log('');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    // Cleanup
    console.log('Cleaning up...');
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
