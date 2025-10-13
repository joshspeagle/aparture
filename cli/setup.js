#!/usr/bin/env node

/**
 * setup.js
 *
 * Aparture CLI - Interactive Setup
 *
 * Opens a browser window for configuring Aparture settings that will persist
 * for automated analysis runs. This allows you to:
 * - Select arXiv categories
 * - Choose models for each stage (filtering, scoring, PDF analysis)
 * - Set batch sizes and thresholds
 * - Configure NotebookLM duration and model
 * - Test settings with dry run or minimal test
 *
 * All settings are saved to browser localStorage and will be used by
 * subsequent 'npm run analyze' commands.
 *
 * Usage:
 *   npm run setup
 *
 * The browser will stay open until you manually close it or press Ctrl+C.
 * Take your time to configure and test your settings!
 */

const BrowserAutomation = require('./browser-automation');
const { ServerManager } = require('./server-manager');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const CONFIG = {
  serverPort: 3000,
  headless: false, // Always visible for setup
  envFile: path.join(__dirname, '../.env.local'),
  setupTimeout: 43200000 // 12 hours - user can exit anytime with Ctrl+C
};

/**
 * Log status message
 */
function log(message, passed = true) {
  const icon = passed ? '✓' : '✗';
  console.log(`${icon} ${message}`);
}

/**
 * Read password from .env.local
 */
async function readPassword() {
  try {
    const envContent = await fs.readFile(CONFIG.envFile, 'utf8');
    const match = envContent.match(/^ACCESS_PASSWORD=(.+)$/m);
    if (!match) {
      throw new Error('ACCESS_PASSWORD not found in .env.local');
    }
    return match[1].trim();
  } catch (error) {
    throw new Error(`Failed to read password from .env.local: ${error.message}`);
  }
}

/**
 * Main setup workflow
 */
async function runSetup() {
  const server = new ServerManager(CONFIG.serverPort);
  const browser = new BrowserAutomation();

  try {
    console.log('\n' + '='.repeat(70));
    console.log('=== Aparture: Interactive Setup ===');
    console.log('='.repeat(70));
    console.log('\nThis will open a browser window where you can configure all settings');
    console.log('for automated analysis runs. Your configuration will be saved and used');
    console.log('by subsequent "npm run analyze" commands.\n');
    console.log('Take your time to:');
    console.log('  • Select arXiv categories');
    console.log('  • Choose models for each processing stage');
    console.log('  • Set batch sizes and score thresholds');
    console.log('  • Configure NotebookLM duration and model');
    console.log('  • Optionally test with "Mock Dry Run" or "Minimal API Test"\n');
    console.log('Press Ctrl+C when you\'re done (your settings are auto-saved).\n');
    console.log('='.repeat(70) + '\n');

    // Step 1: Get password
    console.log('Step 1: Reading password from .env.local...');
    const password = await readPassword();
    log('Password loaded');

    // Step 2: Start server
    console.log('\nStep 2: Starting development server...');
    await server.start();
    log(`Server running on http://localhost:${CONFIG.serverPort}`);

    // Step 3: Launch browser with persistent context
    console.log('\nStep 3: Launching browser...');
    await browser.launch(CONFIG.headless, {
      userDataDir: path.join(process.cwd(), 'temp', 'browser-profile')
    });
    log('Browser launched with persistent profile');

    // Step 4: Navigate to app
    console.log('\nStep 4: Opening Aparture...');
    await browser.navigate(`http://localhost:${CONFIG.serverPort}`);
    log('Application loaded');

    // Step 5: Clear saved password to force re-authentication
    console.log('\nStep 5: Preparing authentication...');
    await browser.getPage().evaluate(() => {
      const state = localStorage.getItem('arxivAnalyzerState');
      if (state) {
        try {
          const parsed = JSON.parse(state);
          if (parsed.password) {
            delete parsed.password;
            localStorage.setItem('arxivAnalyzerState', JSON.stringify(parsed));
          }
        } catch (e) {
          // Ignore errors
        }
      }
    });
    await browser.getPage().reload({ waitUntil: 'domcontentloaded' });
    log('Cleared saved password');

    // Step 6: Authenticate
    console.log('\nStep 6: Authenticating...');
    await browser.authenticate(password);
    log('Authentication successful');

    // Step 7: Wait for user configuration
    console.log('\n' + '='.repeat(70));
    console.log('✓ Setup Complete - Configure Your Settings');
    console.log('='.repeat(70));
    console.log('\nThe browser window is now open and ready for configuration.');
    console.log('\nRecommended workflow:');
    console.log('  1. Configure your settings in the UI');
    console.log('  2. Run "Mock Dry Run" to verify workflow (optional)');
    console.log('  3. Run "Minimal API Test" to test real API calls (optional)');
    console.log('  4. When satisfied, press Ctrl+C to exit\n');
    console.log('Your settings will be automatically saved and used by:');
    console.log('  npm run analyze                    # Full analysis with NotebookLM');
    console.log('  npm run analyze --skip-notebooklm  # Full analysis without NotebookLM\n');
    console.log('Waiting for user configuration (press Ctrl+C to exit)...\n');

    // Keep alive until user exits
    await new Promise((resolve) => {
      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        console.log('\n\n' + '='.repeat(70));
        console.log('✓ Setup Complete!');
        console.log('='.repeat(70));
        console.log('\nYour settings have been saved to browser localStorage.');
        console.log('They will persist across runs of "npm run analyze".\n');
        console.log('To reconfigure, run "npm run setup" again.\n');
        resolve();
      });

      // Auto-exit after timeout (1 hour) as safety measure
      setTimeout(() => {
        console.log('\n\n' + '='.repeat(70));
        console.log('⏱ Setup Timeout');
        console.log('='.repeat(70));
        console.log('\nSetup has been open for 1 hour. Auto-exiting...');
        console.log('Your settings have been saved.\n');
        resolve();
      }, CONFIG.setupTimeout);
    });

  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    if (browser) {
      try {
        await browser.close();
        log('Browser closed');
      } catch (err) {
        console.log('  (Browser already closed)');
      }
    }
    if (server) {
      await server.stop();
      log('Server stopped');
    }
    console.log('');
  }
}

// Run setup
runSetup();
