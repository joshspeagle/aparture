#!/usr/bin/env node

/**
 * test-browser-auth.js
 *
 * Phase 2 Test: Authentication & Config Reading
 *
 * Tests:
 * - Password authentication
 * - Main UI access after login
 * - localStorage reading (config extraction)
 * - Logout functionality
 */

const BrowserAutomation = require('./browser-automation');
const { ServerManager } = require('./server-manager');
const path = require('path');
const fs = require('fs').promises;

// Test configuration
const TEST_CONFIG = {
  serverPort: 3000,
  screenshotDir: path.join(__dirname, '../reports/test-screenshots'),
  headless: true, // Set to false for debugging
  envFile: path.join(__dirname, '../.env.local')
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
 * Run Phase 2 authentication test
 */
async function runTest() {
  const browser = new BrowserAutomation();
  const server = new ServerManager(TEST_CONFIG.serverPort);
  let serverStartedByTest = false;

  try {
    console.log('\n=== Phase 2: Authentication & Config Reading ===\n');

    // Step 1: Get password
    console.log('Step 1: Reading password from .env.local...');
    const password = await readPassword();
    logTest(`Password loaded: ${password.substring(0, 4)}****`);

    // Step 2: Ensure server is running
    console.log('\nStep 2: Checking server status...');
    const serverInfo = await server.ensure();
    serverStartedByTest = serverInfo.started === true;
    logTest(`Server running at ${server.getBaseUrl()}`);

    // Step 3: Launch browser
    console.log('\nStep 3: Launching browser...');
    await browser.launch(TEST_CONFIG.headless);
    logTest('Browser launched');

    // Step 4: Navigate to Aparture
    console.log('\nStep 4: Navigating to Aparture...');
    await browser.navigate(server.getBaseUrl());
    logTest('Navigated to Aparture');

    // Step 5: Verify we're on password screen
    console.log('\nStep 5: Verifying password screen...');
    const hasPasswordPrompt = await browser.exists('input[type="password"]');
    if (!hasPasswordPrompt) {
      throw new Error('Password prompt not found - may already be authenticated');
    }
    logTest('Password screen detected');

    // Step 6: Authenticate
    console.log('\nStep 6: Authenticating...');
    await browser.authenticate(password);
    logTest('Authentication successful');

    // Take screenshot of authenticated UI
    await browser.takeScreenshot(
      path.join(TEST_CONFIG.screenshotDir, 'authenticated-ui.png'),
      { fullPage: true }
    );
    logTest('Screenshot captured: authenticated-ui.png');

    // Step 7: Verify authenticated state
    console.log('\nStep 7: Verifying authenticated state...');
    const isAuth = await browser.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication verification failed');
    }
    logTest('Main UI visible - authenticated state confirmed');

    // Step 8: Read localStorage config
    console.log('\nStep 8: Reading localStorage configuration...');
    const localStorage = await browser.getAllLocalStorage();
    const configKeys = Object.keys(localStorage);

    logTest(`Found ${configKeys.length} localStorage items`);

    if (configKeys.length > 0) {
      console.log('\n  localStorage keys:');
      configKeys.forEach(key => {
        const value = localStorage[key];
        const preview = value.length > 50
          ? `${value.substring(0, 50)}...`
          : value;
        console.log(`    - ${key}: ${preview}`);
      });
    }

    // Step 9: Test logout
    console.log('\nStep 9: Testing logout...');
    await browser.logout();
    logTest('Logout initiated (localStorage cleared)');

    // Wait for password screen to reappear
    await browser.waitForSelector('input[type="password"]', { timeout: 10000 });
    logTest('Password screen reappeared after logout');

    // Take screenshot of logout
    await browser.takeScreenshot(
      path.join(TEST_CONFIG.screenshotDir, 'after-logout.png'),
      { fullPage: true }
    );
    logTest('Screenshot captured: after-logout.png');

    // Success!
    console.log('\n' + '='.repeat(50));
    console.log('✓ All Phase 2 tests passed!');
    console.log('='.repeat(50));
    console.log('\nThis validates:');
    console.log('  - Password authentication works');
    console.log('  - Main UI access after login');
    console.log('  - localStorage reading capabilities');
    console.log('  - Logout functionality');
    console.log('  - Ready for Phase 3 (dry run execution)');
    console.log('');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);

    // Take error screenshot
    try {
      await browser.takeScreenshot(
        path.join(TEST_CONFIG.screenshotDir, 'auth-error.png'),
        { fullPage: true }
      );
      console.error('Error screenshot saved: auth-error.png');
    } catch (screenshotError) {
      // Ignore screenshot errors
    }

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
