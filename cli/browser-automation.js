const { chromium } = require('playwright');

/**
 * BrowserAutomation - Playwright wrapper for Aparture UI automation
 *
 * Provides core browser automation primitives for interacting with
 * the Aparture web interface programmatically.
 */
class BrowserAutomation {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Launch browser instance
   * @param {boolean} headless - Run in headless mode (default: true)
   * @param {Object} options - Additional Playwright launch options
   * @returns {Promise<void>}
   */
  async launch(headless = true, options = {}) {
    const launchOptions = {
      headless,
      ...options
    };

    this.browser = await chromium.launch(launchOptions);
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    this.page = await this.context.newPage();
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
}

module.exports = BrowserAutomation;
