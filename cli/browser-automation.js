const { chromium } = require('playwright');
const path = require('path');

/**
 * BrowserAutomation - Playwright wrapper for Aparture UI automation
 *
 * Provides core browser automation primitives for interacting with
 * the Aparture web interface programmatically.
 *
 * Uses persistent browser context to preserve localStorage (configuration)
 * between runs.
 */
class BrowserAutomation {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isPersistent = false;
  }

  /**
   * Launch browser instance with persistent context
   * @param {boolean} headless - Run in headless mode (default: true)
   * @param {Object} options - Additional Playwright launch options
   * @returns {Promise<void>}
   */
  async launch(headless = true, options = {}) {
    const userDataDir = options.userDataDir || path.join(process.cwd(), 'temp', 'browser-profile');

    const launchOptions = {
      headless,
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
      ...options
    };

    // Use persistent context to preserve localStorage between runs
    this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    this.isPersistent = true;

    // Get the first page (or create one if none exist)
    const pages = this.context.pages();
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.context.newPage();
    }
  }

  /**
   * Navigate to URL
   * @param {string} url - Target URL
   * @param {Object} options - Navigation options (waitUntil, timeout)
   * @returns {Promise<void>}
   */
  async navigate(url, options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const navOptions = {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
      ...options
    };

    await this.page.goto(url, navOptions);
  }

  /**
   * Wait for selector to appear
   * @param {string} selector - CSS selector
   * @param {Object} options - Wait options (timeout, state)
   * @returns {Promise<void>}
   */
  async waitForSelector(selector, options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const waitOptions = {
      timeout: 10000,
      state: 'visible',
      ...options
    };

    await this.page.waitForSelector(selector, waitOptions);
  }

  /**
   * Take screenshot of current page
   * @param {string} path - Output file path
   * @param {Object} options - Screenshot options (fullPage, etc.)
   * @returns {Promise<void>}
   */
  async takeScreenshot(path, options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const screenshotOptions = {
      path,
      fullPage: false,
      ...options
    };

    await this.page.screenshot(screenshotOptions);
  }

  /**
   * Get page title
   * @returns {Promise<string>}
   */
  async getTitle() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    return await this.page.title();
  }

  /**
   * Click element
   * @param {string} selector - CSS selector
   * @param {Object} options - Click options
   * @returns {Promise<void>}
   */
  async click(selector, options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.page.click(selector, options);
  }

  /**
   * Fill input field
   * @param {string} selector - CSS selector
   * @param {string} value - Value to fill
   * @returns {Promise<void>}
   */
  async fill(selector, value) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.page.fill(selector, value);
  }

  /**
   * Get text content of element
   * @param {string} selector - CSS selector
   * @returns {Promise<string>}
   */
  async getText(selector) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    return await this.page.textContent(selector);
  }

  /**
   * Check if element exists
   * @param {string} selector - CSS selector
   * @returns {Promise<boolean>}
   */
  async exists(selector) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const element = await this.page.$(selector);
    return element !== null;
  }

  /**
   * Close browser and cleanup
   * @returns {Promise<void>}
   */
  async close() {
    if (this.isPersistent) {
      // For persistent context, just close the context (which closes all pages)
      if (this.context) {
        await this.context.close();
        this.context = null;
        this.page = null;
      }
    } else {
      // For non-persistent, close page, context, and browser separately
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /**
   * Get direct access to Playwright page object
   * For advanced operations not covered by wrapper methods
   * @returns {Page|null}
   */
  getPage() {
    return this.page;
  }

  // ==================== localStorage Methods ====================

  /**
   * Get localStorage item
   * @param {string} key - Storage key
   * @returns {Promise<string|null>}
   */
  async getLocalStorage(key) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    return await this.page.evaluate((k) => {
      return localStorage.getItem(k);
    }, key);
  }

  /**
   * Set localStorage item
   * @param {string} key - Storage key
   * @param {string} value - Storage value
   * @returns {Promise<void>}
   */
  async setLocalStorage(key, value) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.page.evaluate(({ k, v }) => {
      localStorage.setItem(k, v);
    }, { k: key, v: value });
  }

  /**
   * Get all localStorage data
   * @returns {Promise<Object>}
   */
  async getAllLocalStorage() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    return await this.page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        storage[key] = localStorage.getItem(key);
      }
      return storage;
    });
  }

  /**
   * Clear localStorage
   * @returns {Promise<void>}
   */
  async clearLocalStorage() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.page.evaluate(() => {
      localStorage.clear();
    });
  }

  // ==================== Authentication Methods ====================

  /**
   * Authenticate with password
   * @param {string} password - Access password
   * @param {Object} options - Options (passwordSelector, buttonSelector)
   * @returns {Promise<boolean>} - True if authentication successful
   */
  async authenticate(password, options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const passwordSelector = options.passwordSelector || 'input[type="password"]';
    const buttonSelector = options.buttonSelector || 'button:has-text("Access Analyzer")';

    // Fill password
    await this.fill(passwordSelector, password);

    // Click login button
    await this.click(buttonSelector);

    // Wait for either success (main UI) or error
    try {
      // Wait for main UI to appear (config form, buttons, etc.)
      // Look for "Start Analysis" button which appears after successful auth
      await this.page.waitForSelector('button:has-text("Start Analysis")', {
        timeout: 10000,
        state: 'visible'
      });
      return true;
    } catch (error) {
      // Check if still on password screen (auth failed)
      const stillOnPasswordScreen = await this.exists(passwordSelector);
      if (stillOnPasswordScreen) {
        throw new Error('Authentication failed: incorrect password');
      }
      throw error;
    }
  }

  /**
   * Check if authenticated (main UI visible)
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if main UI is visible (Start Analysis button or Configuration section)
    return await this.exists('button:has-text("Start Analysis")');
  }

  /**
   * Logout (clear localStorage and reload)
   * @returns {Promise<void>}
   */
  async logout() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.clearLocalStorage();
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  // ==================== Test Execution Methods ====================

  /**
   * Expand the System Tests section if collapsed
   * @returns {Promise<void>}
   */
  async expandSystemTests() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if System Tests section exists and is collapsed
    const systemTestsButton = await this.page.$('button:has-text("System Tests")');
    if (!systemTestsButton) {
      throw new Error('System Tests section not found');
    }

    // Check if already expanded by looking for test buttons
    const isDryRunVisible = await this.exists('button:has-text("Run Dry Test")');
    const isRunAgainVisible = await this.exists('button:has-text("Run Again")');
    const isMinimalTestVisible = await this.exists('button:has-text("Run API Test")');

    if (!isDryRunVisible && !isRunAgainVisible && !isMinimalTestVisible) {
      // Section is collapsed, click to expand
      await this.click('button:has-text("System Tests")');
      // Wait for any test button to appear
      await this.page.waitForTimeout(1000); // Give it time to expand
    }
  }

  /**
   * Click the "Run Dry Test" button
   * @returns {Promise<void>}
   */
  async startDryRun() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Ensure System Tests is expanded
    await this.expandSystemTests();

    // Click the dry run button
    const dryRunButton = await this.page.$('button:has-text("Run Dry Test")');
    if (!dryRunButton) {
      // Maybe it says "Run Again" if already completed
      const runAgainButton = await this.page.$('button:has-text("Run Again")');
      if (runAgainButton) {
        await runAgainButton.click();
      } else {
        throw new Error('Dry run button not found');
      }
    } else {
      await dryRunButton.click();
    }
  }

  /**
   * Wait for dry run to complete
   * @param {Object} options - Wait options (timeout, pollInterval)
   * @returns {Promise<boolean>} - True if completed successfully
   */
  async waitForDryRunComplete(options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const timeout = options.timeout || 300000; // 5 minutes default
    const pollInterval = options.pollInterval || 2000; // 2 seconds

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if "Run Again" button appears (indicates completion)
      const hasRunAgain = await this.exists('button:has-text("Run Again")');
      if (hasRunAgain) {
        return true;
      }

      // Check if still testing
      const isTesting = await this.exists('button:has-text("Testing...")');
      if (!isTesting) {
        // Not testing and no "Run Again" - might be an error
        // Check for error messages or if dry run button is back
        const hasDryRunButton = await this.exists('button:has-text("Run Dry Test")');
        if (hasDryRunButton) {
          // Completed and reset somehow
          return true;
        }
      }

      await this.page.waitForTimeout(pollInterval);
    }

    throw new Error(`Dry run did not complete within ${timeout}ms`);
  }

  /**
   * Check if report is available for download
   * @returns {Promise<boolean>}
   */
  async isReportAvailable() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if download button is enabled (not "No Report Available")
    const noReportButton = await this.exists('button:has-text("No Report Available")');
    return !noReportButton;
  }

  /**
   * Download report
   * @param {string} downloadPath - Directory to save download
   * @returns {Promise<string>} - Path to downloaded file
   */
  async downloadReport(downloadPath) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if report is available
    if (!(await this.isReportAvailable())) {
      throw new Error('No report available for download');
    }

    // Set up download handling
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 10000 }),
      this.page.click('button:has-text("Download Report")')
    ]);

    // Save the download
    const fileName = download.suggestedFilename();
    const filePath = `${downloadPath}/${fileName}`;
    await download.saveAs(filePath);

    return filePath;
  }

  /**
   * Check if NotebookLM generation button is available
   * @returns {Promise<boolean>}
   */
  async isNotebookLMAvailable() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if "Generate NotebookLM" button exists and is not disabled
    const button = await this.page.$('button:has-text("Generate NotebookLM")');
    if (!button) {
      return false;
    }

    const isDisabled = await this.page.evaluate((btn) => {
      return btn.disabled;
    }, button);

    return !isDisabled;
  }

  /**
   * Generate NotebookLM document
   * Uses the duration and model settings already configured in the UI (persisted in localStorage)
   * @returns {Promise<void>}
   */
  async generateNotebookLM() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if NotebookLM generation is available
    if (!(await this.isNotebookLMAvailable())) {
      throw new Error('NotebookLM generation not available - no papers analyzed yet');
    }

    // Click "Generate NotebookLM" button
    await this.page.click('button:has-text("Generate NotebookLM")');

    // Wait a moment for generation to start
    await this.page.waitForTimeout(1000);
  }

  /**
   * Wait for NotebookLM generation to complete
   * @param {Object} options - { timeout, pollInterval }
   * @returns {Promise<boolean>} - True if completed successfully
   */
  async waitForNotebookLMComplete(options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const timeout = options.timeout || 300000; // 5 minutes default
    const pollInterval = options.pollInterval || 2000; // 2 seconds

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if "Download NotebookLM" button appears (indicates completion)
      const hasDownloadButton = await this.exists('button:has-text("Download NotebookLM")');
      if (hasDownloadButton) {
        return true;
      }

      // Check if still generating (button says "Generating...")
      const isGenerating = await this.exists('button:has-text("Generating...")');
      if (!isGenerating) {
        // Not generating and no download button - might be an error
        // Check for error messages in status
        const status = await this.page.evaluate(() => {
          const statusElements = document.querySelectorAll('p');
          for (const el of statusElements) {
            if (el.textContent.includes('NotebookLM') || el.textContent.includes('Error')) {
              return el.textContent;
            }
          }
          return null;
        });

        if (status && status.includes('Error')) {
          throw new Error(`NotebookLM generation failed: ${status}`);
        }

        // Otherwise might have completed - check for download button again
        const hasDownload = await this.exists('button:has-text("Download NotebookLM")');
        if (hasDownload) {
          return true;
        }
      }

      await this.page.waitForTimeout(pollInterval);
    }

    throw new Error(`NotebookLM generation did not complete within ${timeout}ms`);
  }

  /**
   * Download NotebookLM document
   * @param {string} downloadPath - Directory to save download
   * @returns {Promise<string>} - Path to downloaded file
   */
  async downloadNotebookLM(downloadPath) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if download button is available
    const hasDownloadButton = await this.exists('button:has-text("Download NotebookLM")');
    if (!hasDownloadButton) {
      throw new Error('NotebookLM document not available for download');
    }

    // Set up download handling
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 10000 }),
      this.page.click('button:has-text("Download NotebookLM")')
    ]);

    // Save the download
    const fileName = download.suggestedFilename();
    const filePath = `${downloadPath}/${fileName}`;
    await download.saveAs(filePath);

    return filePath;
  }

  /**
   * Get current stage from Progress section
   * @returns {Promise<string>}
   */
  async getCurrentStage() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Look for "Current Stage:" text
    const stageElement = await this.page.$('text=Current Stage:');
    if (!stageElement) {
      return 'Unknown';
    }

    // Get the next sibling or text content
    const stageText = await this.page.evaluate(() => {
      const element = document.evaluate(
        "//text()[contains(., 'Current Stage:')]/following-sibling::text()[1]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      return element ? element.textContent.trim() : null;
    });

    return stageText || 'Unknown';
  }

  /**
   * Click the "Run API Test" button (Minimal API Test)
   * @returns {Promise<void>}
   */
  async startMinimalTest() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Ensure System Tests is expanded
    await this.expandSystemTests();

    // Click the minimal test button
    const minimalButton = await this.page.$('button:has-text("Run API Test")');
    if (!minimalButton) {
      throw new Error('Minimal API Test button not found');
    }

    await minimalButton.click();
  }

  /**
   * Wait for minimal test to complete
   * @param {Object} options - Wait options (timeout, pollInterval)
   * @returns {Promise<boolean>} - True if completed successfully
   */
  async waitForMinimalTestComplete(options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const timeout = options.timeout || 600000; // 10 minutes default (API calls take longer)
    const pollInterval = options.pollInterval || 3000; // 3 seconds

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if "Run API Test" button is back (indicates completion)
      // The button text returns to "Run API Test" after completion
      const hasRunButton = await this.exists('button:has-text("Run API Test")');

      // Also check if there's a "Testing..." state
      const isTesting = await this.exists('button:has-text("Testing...")');

      if (hasRunButton && !isTesting) {
        // Completed
        return true;
      }

      await this.page.waitForTimeout(pollInterval);
    }

    throw new Error(`Minimal test did not complete within ${timeout}ms`);
  }

  // ==================== Full Analysis Methods ====================

  /**
   * Click the "Start Analysis" button to begin full production run
   * @returns {Promise<void>}
   */
  async startFullAnalysis() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Click the main "Start Analysis" button
    const startButton = await this.page.$('button:has-text("Start Analysis")');
    if (!startButton) {
      throw new Error('Start Analysis button not found');
    }

    await startButton.click();

    // Wait a moment for processing to begin
    await this.page.waitForTimeout(1000);

    // Verify that processing started (button should change to Pause/Abort controls)
    const isProcessing = await this.exists('button:has-text("Pause")') ||
                         await this.exists('button:has-text("Resume")') ||
                         await this.exists('button:has-text("Abort")');

    if (!isProcessing) {
      throw new Error('Analysis does not appear to have started');
    }
  }

  /**
   * Get current processing stage and progress
   * @returns {Promise<Object>} - { stage, current, total, isPaused }
   */
  async getCurrentProgress() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Get stage - look for stage indicator in UI
    let stage = 'unknown';
    try {
      // Try to extract stage from the processing section
      // The UI shows stages like "fetching", "Filtering", "initial-scoring", etc.
      const stageText = await this.page.evaluate(() => {
        // Look for progress section text patterns
        const progressSection = document.body.innerText;

        // Match common stage patterns (ORDER MATTERS - check PDF analysis BEFORE 'Download Report')
        if (progressSection.includes('Fetching papers') || progressSection.includes('Fetching category')) {
          return 'fetching';
        } else if (progressSection.includes('Filtering')) {
          return 'filtering';
        } else if (progressSection.includes('Scoring') || progressSection.includes('initial-scoring')) {
          return 'scoring';
        } else if (progressSection.includes('Post-Processing')) {
          return 'post-processing';
        }
        // Check for PDF analysis stage - MUST come before 'complete' check
        // UI shows: "Analyzing PDFs" (plural), "Analyzing paper" (singular during processing)
        // Also check for progress like "Analyzing paper 3 of 20"
        else if (progressSection.includes('Analyzing PDF') ||
                 progressSection.includes('deep-analysis') ||
                 progressSection.includes('Analyzing paper') ||
                 /Analyzing\s+\d+\s+of\s+\d+/.test(progressSection)) {
          return 'pdf-analysis';
        }
        // Only mark complete if truly done (NOT just because Download Report button exists)
        else if (progressSection.includes('Analysis complete')) {
          return 'complete';
        }

        return 'processing';
      });

      if (stageText) {
        stage = stageText;
      }
    } catch (err) {
      // Ignore errors, keep 'unknown'
    }

    // Get progress numbers (current / total)
    let current = 0;
    let total = 0;
    try {
      const progressText = await this.page.evaluate(() => {
        // Look for progress indicators like "15 / 344" or "Processing 3 of 10"
        const text = document.body.innerText;

        // Match patterns like "X / Y" or "X of Y"
        const slashMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
        if (slashMatch) {
          return { current: parseInt(slashMatch[1]), total: parseInt(slashMatch[2]) };
        }

        const ofMatch = text.match(/(\d+)\s+of\s+(\d+)/i);
        if (ofMatch) {
          return { current: parseInt(ofMatch[1]), total: parseInt(ofMatch[2]) };
        }

        return null;
      });

      if (progressText) {
        current = progressText.current;
        total = progressText.total;
      }
    } catch (err) {
      // Ignore errors
    }

    // Check if paused
    const isPaused = await this.exists('button:has-text("Resume")');

    return {
      stage,
      current,
      total,
      isPaused
    };
  }

  /**
   * Get status messages from the logs/errors panel
   * @param {number} limit - Maximum number of messages to return (most recent)
   * @returns {Promise<Array<string>>}
   */
  async getStatusMessages(limit = 50) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    try {
      const messages = await this.page.evaluate((maxMessages) => {
        // Find the errors/logs section - it has timestamped messages
        const errorMessages = [];

        // Look for the errors/logs panel - typically has class indicators
        // Messages are formatted like "[7:35:01 AM] Message text"
        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n');

        for (const line of lines) {
          // Match timestamp pattern [HH:MM:SS AM/PM]
          if (line.match(/\[\d{1,2}:\d{2}:\d{2}\s(?:AM|PM)\]/)) {
            errorMessages.push(line.trim());
          }
        }

        // Return most recent messages
        return errorMessages.slice(-maxMessages);
      }, limit);

      return messages;
    } catch (err) {
      return [];
    }
  }

  /**
   * Wait for full analysis to complete through all stages
   * Stages: fetching → filtering → scoring → post-processing → pdf-analysis → complete
   * @param {Object} options - { timeout, onProgress, pollInterval, verbose }
   * @returns {Promise<boolean>} - True if completed successfully
   */
  async waitForFullAnalysisComplete(options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const timeout = options.timeout || 7200000; // 120 minutes (2 hours) default - runtimes often around 80 minutes
    const pollInterval = options.pollInterval || 5000; // 5 seconds
    const onProgress = options.onProgress || null;
    const verbose = options.verbose || false;

    const startTime = Date.now();
    let lastStage = '';
    let lastProgress = '';
    let stageStartTime = Date.now();
    let stageTimings = {};

    while (Date.now() - startTime < timeout) {
      // Get current progress to check stage
      const progress = await this.getCurrentProgress();

      // Check if we're truly done (not just filtering complete)
      // Report button appears after filtering, but PDF analysis may still be pending
      const reportAvailable = await this.isReportAvailable();
      const stillProcessing = await this.exists('button:has-text("Pause")') ||
                              await this.exists('button:has-text("Resume")');

      // Consider it complete only if:
      // 1. Report is available AND
      // 2. Not currently processing (no Pause/Resume buttons) AND
      // 3. Not in pdf-analysis stage AND
      // 4. Stage is explicitly 'complete' (not just 'filtering', 'scoring', etc.)
      const isPdfAnalysisPending = progress.stage === 'pdf-analysis' ||
                                    progress.stage === 'deep-analysis' ||
                                    // If transitioning from filtering and report just appeared, PDF analysis is pending
                                    (reportAvailable && !stillProcessing && lastStage === 'filtering') ||
                                    // If transitioning from scoring and report available, might be pending
                                    (reportAvailable && !stillProcessing && lastStage === 'scoring');

      if (reportAvailable && !stillProcessing && !isPdfAnalysisPending && progress.stage === 'complete') {
        // Wait to ensure PDF analysis isn't about to start (triple-check)
        await this.page.waitForTimeout(5000);

        // Check again after waiting - all three checks must pass
        const progress2 = await this.getCurrentProgress();
        const stillNotPdfAnalysis = progress2.stage !== 'pdf-analysis' &&
                                     progress2.stage !== 'deep-analysis';
        const reportStillAvailable = await this.isReportAvailable();
        const stillNotProcessing = !(await this.exists('button:has-text("Pause")') ||
                                      await this.exists('button:has-text("Resume")'));

        if (stillNotPdfAnalysis && reportStillAvailable && stillNotProcessing && progress2.stage === 'complete') {
          // Truly completed!
          if (lastStage && lastStage !== 'complete') {
            const stageDuration = Date.now() - stageStartTime;
            stageTimings[lastStage] = stageDuration;
          }

          if (verbose) {
            console.log('\n=== Stage Timings ===');
            for (const [stage, duration] of Object.entries(stageTimings)) {
              const minutes = Math.floor(duration / 60000);
              const seconds = Math.floor((duration % 60000) / 1000);
              console.log(`  ${stage}: ${minutes}m ${seconds}s`);
            }
          }

          return true;
        } else {
          if (verbose) {
            console.log('  ⚠ Completion check failed - PDF analysis may be starting');
            console.log(`    Stage after wait: ${progress2.stage}`);
            console.log(`    Is PDF analysis: ${!stillNotPdfAnalysis}`);
          }
        }
      }

      // Detect stage transition
      if (progress.stage !== lastStage && progress.stage !== 'unknown') {
        if (lastStage && lastStage !== 'unknown') {
          const stageDuration = Date.now() - stageStartTime;
          stageTimings[lastStage] = stageDuration;

          if (verbose) {
            const minutes = Math.floor(stageDuration / 60000);
            const seconds = Math.floor((stageDuration % 60000) / 1000);
            console.log(`  ${lastStage} completed in ${minutes}m ${seconds}s`);
          }
        }

        lastStage = progress.stage;
        stageStartTime = Date.now();

        // Call progress callback
        if (onProgress) {
          onProgress({
            type: 'stage_change',
            stage: progress.stage,
            progress: { current: progress.current, total: progress.total }
          });
        }
      }

      // Detect progress change
      const progressStr = `${progress.current}/${progress.total}`;
      if (progressStr !== lastProgress && progress.total > 0) {
        lastProgress = progressStr;

        if (onProgress) {
          onProgress({
            type: 'progress_update',
            stage: progress.stage,
            progress: { current: progress.current, total: progress.total }
          });
        }
      }

      // Handle pause state
      if (progress.isPaused) {
        if (onProgress) {
          onProgress({
            type: 'paused',
            stage: progress.stage
          });
        }

        if (verbose) {
          console.log('  ⏸ Analysis is paused, waiting for resume...');
        }
      }

      await this.page.waitForTimeout(pollInterval);
    }

    throw new Error(`Full analysis did not complete within ${timeout}ms`);
  }

  /**
   * Check if analysis is currently paused
   * @returns {Promise<boolean>}
   */
  async isPaused() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    return await this.exists('button:has-text("Resume")');
  }

  /**
   * Resume paused analysis
   * @returns {Promise<void>}
   */
  async resumeAnalysis() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const resumeButton = await this.page.$('button:has-text("Resume")');
    if (!resumeButton) {
      throw new Error('Resume button not found - analysis may not be paused');
    }

    await resumeButton.click();
    await this.page.waitForTimeout(1000); // Wait for resume to take effect
  }

  /**
   * Abort running analysis
   * @returns {Promise<void>}
   */
  async abortAnalysis() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const abortButton = await this.page.$('button:has-text("Abort")');
    if (!abortButton) {
      throw new Error('Abort button not found - analysis may not be running');
    }

    await abortButton.click();
    await this.page.waitForTimeout(1000); // Wait for abort to take effect
  }
}

module.exports = BrowserAutomation;
