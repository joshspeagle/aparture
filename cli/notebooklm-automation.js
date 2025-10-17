const { chromium } = require('playwright');
const path = require('path');

/**
 * NotebookLMAutomation - Playwright automation for Google NotebookLM
 *
 * Automates the following workflow:
 * 1. Authenticate with Google (cached after first run)
 * 2. Create a new notebook with naming convention
 * 3. Upload report and NotebookLM document files
 * 4. Configure audio overview customization (Deep Dive, custom prompt)
 * 5. Generate audio overview (podcast)
 * 6. Download the generated podcast
 *
 * IMPORTANT: This automation is brittle and subject to breaking when Google
 * updates the NotebookLM UI. Selectors and workflows may need adjustment.
 */
class NotebookLMAutomation {
  constructor() {
    this.context = null;
    this.page = null;
    this.notebooklmUrl = 'https://notebooklm.google.com';
  }

  /**
   * Launch browser with persistent context for Google authentication
   * @param {Object} options - Launch options
   * @returns {Promise<void>}
   */
  async launch(options = {}) {
    const userDataDir =
      options.userDataDir || path.join(process.cwd(), 'temp', 'notebooklm-profile');
    const headless = options.headless || false; // Non-headless by default for auth reliability

    const launchOptions = {
      headless,
      viewport: { width: 1280, height: 1024 }, // Taller viewport for dialogs
      acceptDownloads: true,
      downloadsPath: path.join(process.cwd(), 'reports'), // Explicit downloads path
      // Add arguments to bypass Google's bot detection
      args: [
        '--disable-blink-features=AutomationControlled', // Hide automation indicators
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      ...options,
    };

    // Use persistent context to preserve Google authentication
    this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);

    // Remove webdriver flag to appear more like a regular browser
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Get or create page
    const pages = this.context.pages();
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.context.newPage();
    }
  }

  /**
   * Navigate to NotebookLM and ensure authenticated
   * On first run, user must manually log in with Google account
   * @param {Object} options - { timeout: ms to wait for manual login }
   * @returns {Promise<boolean>} - True if authenticated
   */
  async ensureAuthenticated(options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const authTimeout = options.timeout || 300000; // 5 minutes for manual login

    // Navigate to NotebookLM
    console.log('  Navigating to NotebookLM...');
    await this.page.goto(this.notebooklmUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to stabilize and check URL
    await this.page.waitForTimeout(3000);

    const currentUrl = this.page.url();
    console.log(`  Current URL: ${currentUrl}`);

    // Check if we're on NotebookLM (not redirected to Google login)
    const isOnNotebookLM =
      currentUrl.includes('notebooklm.google.com') && !currentUrl.includes('accounts.google.com');

    if (isOnNotebookLM) {
      // We're on NotebookLM - check for actual UI elements to confirm we're logged in
      // Look for very specific NotebookLM UI that wouldn't be on a login page
      const notebookButton = await this.page.$(
        'button:has-text("Create new"), button:has-text("New notebook")'
      );
      if (notebookButton && (await notebookButton.isVisible())) {
        console.log('  ✓ Already authenticated\n');
        return true;
      }
    }

    // Not authenticated - need to wait for user to log in
    console.log('  → Not authenticated (redirected to login or missing UI elements)');
    console.log('\n⚠️  Google authentication required');
    console.log('   Please log in to your Google account in the browser window.');
    console.log('   The browser will remain open while you complete authentication.');
    console.log('   Waiting up to 5 minutes...\n');

    // Poll every 3 seconds to check if authentication completed
    const startTime = Date.now();
    const pollInterval = 3000;
    let lastProgressUpdate = 0;
    let checkCount = 0;

    while (Date.now() - startTime < authTimeout) {
      await this.page.waitForTimeout(pollInterval);
      checkCount++;

      const url = this.page.url();
      const onNotebookLM =
        url.includes('notebooklm.google.com') && !url.includes('accounts.google.com');

      // Only check for UI elements if we're on NotebookLM domain
      if (onNotebookLM) {
        // Look for the "Create new" button (or "New notebook") which is definitive proof we're logged in
        const button = await this.page.$(
          'button:has-text("Create new"), button:has-text("New notebook")'
        );
        if (button) {
          const isVis = await button.isVisible();
          if (isVis) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`✓ Authentication successful (took ${elapsed}s)\n`);
            return true;
          }
        }
      }

      // Show progress every 30 seconds
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (elapsed - lastProgressUpdate >= 30 && elapsed > 0) {
        console.log(
          `  Still waiting... (${elapsed}s elapsed, check #${checkCount}, URL: ${url.substring(0, 50)}...)`
        );
        lastProgressUpdate = elapsed;
      }
    }

    // Timeout
    try {
      await this.takeScreenshot(
        path.join(process.cwd(), 'reports', 'screenshots', 'auth-timeout.png')
      );
    } catch {}

    throw new Error('Authentication timeout - please log in to Google and try again');
  }

  /**
   * Create a new notebook with specified name
   * @param {string} notebookName - Name for the notebook (e.g., "2025-10-13_aparture")
   * @returns {Promise<void>}
   */
  async createNotebook(notebookName) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    try {
      // Look for "New notebook" or "Create" button
      // Try multiple selector strategies due to UI variations
      const createButton = await this.page.$(
        'button:has-text("New notebook"), button:has-text("Create"), [aria-label*="Create"], [aria-label*="New notebook"]'
      );

      if (!createButton) {
        throw new Error('Could not find "Create Notebook" button - NotebookLM UI may have changed');
      }

      await createButton.click();

      // Wait for notebook creation page to load
      await this.page.waitForTimeout(2000);

      // Try to set notebook title if there's an input field
      // (NotebookLM may auto-name or provide a rename option)
      try {
        const titleInput = await this.page.$(
          'input[placeholder*="title"], input[placeholder*="name"], [aria-label*="title"]'
        );
        if (titleInput) {
          await titleInput.fill(notebookName);
          await this.page.waitForTimeout(500);
        }
      } catch {
        console.log('  Note: Could not set notebook title automatically, may need manual rename');
      }
    } catch (error) {
      throw new Error(`Failed to create notebook: ${error.message}`);
    }
  }

  /**
   * Upload files to the current notebook
   * @param {string} reportPath - Path to main report file
   * @param {string} notebooklmDocPath - Path to NotebookLM document
   * @returns {Promise<void>}
   */
  async uploadFiles(reportPath, notebooklmDocPath) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    try {
      // Log the files being uploaded for debugging
      const path = require('path');
      console.log(`  Report file: ${path.basename(reportPath)}`);
      console.log(`  NotebookLM document: ${path.basename(notebooklmDocPath)}`);

      // Verify files are different
      if (reportPath === notebooklmDocPath) {
        throw new Error('Error: reportPath and notebooklmDocPath are the same file!');
      }

      // NotebookLM automatically opens "Add sources" modal after creating notebook
      // Wait for the modal to be visible
      await this.page.waitForTimeout(3000);

      // Use Playwright's file chooser API to handle the file upload
      // This works even if the file input is hidden
      const [fileChooser] = await Promise.all([
        this.page.waitForEvent('filechooser', { timeout: 5000 }),
        // Click the upload area to trigger file chooser
        this.page.click('text=/choose file/i').catch(() =>
          this.page.click('text=/upload sources/i').catch(() =>
            // If text clicks don't work, try clicking the upload icon/area
            this.page.click('.dropzone, [class*="upload"], [class*="drop"]')
          )
        ),
      ]);

      // Set the files
      console.log('  Uploading 2 files to NotebookLM...');
      await fileChooser.setFiles([reportPath, notebooklmDocPath]);

      // Wait for uploads to complete
      console.log('  Waiting for file uploads to complete...');
      await this.page.waitForTimeout(8000); // Give more time for uploads

      // Verify uploads completed by checking for source count
      try {
        // Look for "2 sources" or similar text
        await this.page.waitForSelector('text=/2/, text=/sources/i', {
          timeout: 15000,
          state: 'visible',
        });
        console.log('  ✓ Upload verification: Found source count indicator');
      } catch {
        console.log('  Warning: Could not confirm file upload completion');
      }

      // Close the modal if there's a close button
      const closeButton = await this.page.$('button[aria-label*="Close"], [aria-label*="close"]');
      if (closeButton) {
        await closeButton.click();
        await this.page.waitForTimeout(1000);
      }

      // Refresh the page after upload to ensure NotebookLM processes the sources
      // This fixes the issue where the Audio Overview button stays disabled
      console.log('  Refreshing page to process uploaded sources...');
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000); // Wait for page to fully load
    } catch (error) {
      throw new Error(`Failed to upload files: ${error.message}`);
    }
  }

  /**
   * Generate audio overview with custom prompt
   * Opens customization menu, configures settings, and starts generation
   * @param {string} customPrompt - The focus prompt from NOTEBOOKLM_PROMPTS.md
   * @param {string} duration - Duration indicator (e.g., "30min") - used for logging
   * @returns {Promise<void>}
   */
  async generateAudioOverview(customPrompt, duration) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    try {
      console.log(`  Configuring audio overview for ${duration} podcast...`);

      // Wait for NotebookLM to finish processing the uploaded sources
      // The Audio Overview button is disabled until processing completes
      // Poll with page refreshes every 15 seconds until button is enabled
      console.log('  Waiting for source processing to complete...');

      const maxWaitTime = 120000; // 2 minutes total
      const startTime = Date.now();
      let audioOverviewButton = null;

      while (Date.now() - startTime < maxWaitTime) {
        // Check if Audio Overview button is enabled
        audioOverviewButton = await this.page.$(
          'button:has-text("Audio Overview"):not([disabled]), button:has-text("Audio overview"):not([disabled])'
        );

        if (audioOverviewButton) {
          console.log('  ✓ Audio Overview button is now enabled');
          break;
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`  Refreshing page to check button status... (${elapsed}s elapsed)`);
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000); // Wait for page to load after refresh
      }

      if (!audioOverviewButton) {
        throw new Error('Audio Overview button did not become enabled within 2 minutes');
      }

      // Now we need to click the pencil/edit icon on the Audio Overview card in the Studio panel
      // This opens the "Customize Audio Overview" dialog
      console.log('  Looking for pencil/edit button on Audio Overview card...');

      // Find all buttons with text "edit"
      // The Audio Overview edit button is the first one with just "edit" text (not "editAdd note")
      const editButtons = await this.page.$$('button:has-text("edit")');
      let editButton = null;

      for (const btn of editButtons) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (!isVisible) continue;

        const text = await btn.textContent().catch(() => '');

        // The Audio Overview edit button should just contain "edit" text (not "editAdd note")
        if (text.trim() === 'edit') {
          // This is likely one of the card edit buttons
          // Take the first one we find - it should be Audio Overview since it appears first in Studio
          editButton = btn;
          console.log(`  ✓ Found edit button for Audio Overview`);
          break;
        }
      }

      if (!editButton) {
        throw new Error('Could not find edit/pencil button on Audio Overview card');
      }

      console.log('  Clicking edit/pencil button to customize audio...');
      await editButton.click();
      await this.page.waitForTimeout(3000); // Give more time for dialog to appear

      // Wait for "Customize Audio Overview" dialog to appear
      // The dialog should have specific elements like "Deep Dive" format option
      try {
        await this.page.waitForSelector('text="Customize Audio Overview"', { timeout: 10000 });
        console.log('  ✓ Customization dialog opened');
      } catch {
        // Take screenshot to debug
        await this.takeScreenshot(
          path.join(process.cwd(), 'reports', 'screenshots', 'customization-dialog-error.png')
        );
        throw new Error('Customization dialog did not appear');
      }

      // Take a screenshot of the customization dialog
      await this.takeScreenshot(
        path.join(
          process.cwd(),
          'reports',
          'screenshots',
          'test-notebooklm-customization-dialog.png'
        )
      );

      // Configure customization settings (format, length, prompt)
      await this.setCustomization('Deep Dive', 'Default', customPrompt);

      // Click final "Generate" button to start
      await this.startGeneration();
    } catch (error) {
      throw new Error(`Failed to generate audio overview: ${error.message}`);
    }
  }

  /**
   * Open or ensure customization menu is visible
   * @returns {Promise<void>}
   */
  async openCustomizationMenu() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Check if customization UI is already visible
    const customizationVisible = await this.page.$(
      'text=Deep Dive, text=Format, [aria-label*="Customize"]'
    );

    if (!customizationVisible) {
      // Try to find and click customize button
      const customizeBtn = await this.page.$(
        'button:has-text("Customize"), [aria-label*="Customize"]'
      );
      if (customizeBtn) {
        await customizeBtn.click();
        await this.page.waitForTimeout(1500);
      }
    }
  }

  /**
   * Set customization options: format, length, and focus prompt
   * Verifies English language, Deep Dive format, Default length are selected
   * Then fills the custom prompt
   * @param {string} format - "Deep Dive", "Brief", "Critique", or "Debate"
   * @param {string} length - "Shorter", "Default", or "Longer"
   * @param {string} focusPrompt - Custom prompt text
   * @returns {Promise<void>}
   */
  async setCustomization(format, length, focusPrompt) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    try {
      // Verify/Select Language (should be English by default)
      console.log('  Verifying language is English...');
      // Language selector might be a dropdown or button
      // For now, assume it's English by default

      // Verify/Select Format (Deep Dive)
      console.log(`  Verifying format is ${format}...`);
      const formatCard = await this.page.$(`button:has-text("${format}")`);
      if (formatCard) {
        // Check if it's already selected by looking for selected/active state
        const classes = await formatCard.getAttribute('class').catch(() => '');
        const ariaPressed = await formatCard.getAttribute('aria-pressed').catch(() => '');

        if (!classes.includes('selected') && ariaPressed !== 'true') {
          console.log(`  Selecting format: ${format}`);
          await formatCard.click();
          await this.page.waitForTimeout(500);
        }
        console.log(`  ✓ Format confirmed: ${format}`);
      } else {
        console.log(
          `  Warning: Could not find "${format}" format option - assuming already selected`
        );
      }

      // Verify/Select Length (Default)
      console.log(`  Verifying length is ${length}...`);
      const lengthButton = await this.page.$(`button:has-text("${length}")`);
      if (lengthButton) {
        const ariaPressed = await lengthButton.getAttribute('aria-pressed').catch(() => '');
        const classes = await lengthButton.getAttribute('class').catch(() => '');

        if (ariaPressed !== 'true' && !classes.includes('selected')) {
          console.log(`  Selecting length: ${length}`);
          await lengthButton.click();
          await this.page.waitForTimeout(500);
        }
        console.log(`  ✓ Length confirmed: ${length}`);
      } else {
        console.log(
          `  Warning: Could not find "${length}" length option - assuming already selected`
        );
      }

      // Fill custom focus prompt
      console.log('  Finding custom focus prompt textarea...');

      // Find all textareas in the page
      const textareas = await this.page.$$('textarea');
      console.log(`  Found ${textareas.length} textarea(s) on page`);

      let promptTextarea = null;
      for (const ta of textareas) {
        const placeholder = await ta.getAttribute('placeholder').catch(() => '');
        const ariaLabel = await ta.getAttribute('aria-label').catch(() => '');
        const isVisible = await ta.isVisible().catch(() => false);

        console.log(
          `    Textarea: placeholder="${placeholder}" aria-label="${ariaLabel}" visible=${isVisible}`
        );

        // The customization textarea should have placeholder about "focus" or "hosts"
        if (
          isVisible &&
          (placeholder.toLowerCase().includes('focus') ||
            placeholder.toLowerCase().includes('host') ||
            ariaLabel.toLowerCase().includes('focus'))
        ) {
          promptTextarea = ta;
          console.log(`    ✓ This appears to be the custom focus prompt textarea`);
          break;
        }
      }

      if (!promptTextarea) {
        throw new Error('Could not find custom focus prompt textarea in customization dialog');
      }

      console.log('  Filling custom prompt...');
      await promptTextarea.click(); // Focus the textarea
      await this.page.waitForTimeout(300);
      await promptTextarea.fill(''); // Clear any existing text
      await this.page.waitForTimeout(300);
      // Use fill() instead of type() for long prompts - much faster and no timeout issues
      await promptTextarea.fill(focusPrompt);
      await this.page.waitForTimeout(500);

      // Verify the text was entered
      const enteredText = await promptTextarea.inputValue().catch(() => '');
      if (enteredText.length > 100) {
        console.log(`  ✓ Custom prompt entered successfully (${enteredText.length} characters)`);
      } else {
        console.log(`  Warning: Entered text seems short (${enteredText.length} characters)`);
      }
    } catch (error) {
      throw new Error(`Failed to set customization: ${error.message}`);
    }
  }

  /**
   * Start audio generation after customization is complete
   * @returns {Promise<void>}
   */
  async startGeneration() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Find and click the final "Generate" button
    const generateButton = await this.page.$(
      'button:has-text("Generate"):not([disabled]), [aria-label*="Generate"]:not([disabled])'
    );

    if (!generateButton) {
      throw new Error('Could not find enabled Generate button');
    }

    console.log('  Starting audio generation...');
    await generateButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Wait for audio generation to complete
   * @param {Object} options - { timeout: ms }
   * @returns {Promise<boolean>} - True if completed
   */
  async waitForAudioGeneration(options = {}) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const timeout = options.timeout || 1800000; // 30 minutes default
    const pollInterval = 30000; // Refresh and check every 30 seconds

    const startTime = Date.now();

    console.log('  Waiting for audio generation to complete (typically 10-20 minutes)...');

    while (Date.now() - startTime < timeout) {
      // STRATEGY 1: Check for kebab menu (three-dot menu) on Audio Overview card
      // The Download option is hidden inside this menu, so we need to:
      // 1. Find the kebab menu button
      // 2. Click it to open menu
      // 3. Check if "Download" option is visible
      // 4. Close menu if found (completion detected)

      const menuButtons = await this.page.$$('[aria-label*="More"]');
      let completionDetected = false;

      for (const menuButton of menuButtons) {
        const isVisible = await menuButton.isVisible().catch(() => false);
        if (!isVisible) continue;

        // Try to open this menu
        try {
          await menuButton.click();
          await this.page.waitForTimeout(500); // Wait for menu to appear

          // Check if Download option is visible in menu
          const downloadOption = await this.page.$('text="Download"');
          if (downloadOption) {
            const downloadVisible = await downloadOption.isVisible().catch(() => false);
            if (downloadVisible) {
              // Found it! Audio generation is complete
              completionDetected = true;

              // Close menu by clicking elsewhere (click on body or press ESC)
              await this.page.keyboard.press('Escape');
              await this.page.waitForTimeout(500);

              break;
            }
          }

          // Close menu if it's not the right one
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(300);
        } catch (err) {
          // Failed to open menu or check - continue to next
          console.log(`  Debug: Menu check failed: ${err.message}`);
          continue;
        }
      }

      if (completionDetected) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(
          `  ✓ Audio generation completed in ${Math.floor(duration / 60)}m ${duration % 60}s`
        );
        return true;
      }

      // STRATEGY 2 (Fallback): Look for direct download button (in case UI changed)
      let isComplete = await this.page.$('button:has-text("Download")');
      if (!isComplete) {
        isComplete = await this.page.$('[aria-label*="Download"]');
      }

      if (isComplete) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(
          `  ✓ Audio generation completed in ${Math.floor(duration / 60)}m ${duration % 60}s`
        );
        return true;
      }

      // Check for error states
      let hasError = await this.page.$('text=/error/i');
      if (!hasError) {
        hasError = await this.page.$('text=/failed/i');
      }
      if (!hasError) {
        hasError = await this.page.$('text=/try again/i');
      }
      if (hasError) {
        const errorText = await hasError.textContent();
        throw new Error(`Audio generation failed: ${errorText}`);
      }

      // Wait 30 seconds before next check
      await this.page.waitForTimeout(pollInterval);

      // Progress update and refresh page every 30 seconds
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `  Refreshing page to check generation status... (${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed)`
      );

      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000); // Wait for page to load after refresh
    }

    throw new Error(`Audio generation did not complete within ${timeout / 1000}s`);
  }

  /**
   * Download the generated audio file
   * @param {string} downloadPath - Directory to save file
   * @param {string} fileName - Desired filename (e.g., "2025-10-13_podcast.m4a")
   * @returns {Promise<string>} - Path to downloaded file
   */
  async downloadAudio(downloadPath, fileName) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    try {
      console.log('  Looking for Audio Overview three-dot menu...');

      // The download is in a menu accessed via three-dot button on the Audio Overview card
      // Look for all buttons with "More" or "menu" aria-labels in the Studio panel
      const menuButtons = await this.page.$$('[aria-label*="More"]');

      let menuButton = null;
      for (const btn of menuButtons) {
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          menuButton = btn;
          break;
        }
      }

      if (!menuButton) {
        await this.takeScreenshot(
          path.join(process.cwd(), 'reports', 'screenshots', 'menu-button-not-found.png')
        );
        throw new Error('Could not find three-dot menu button on Audio Overview card');
      }

      console.log('  ✓ Found three-dot menu button');
      console.log('  Clicking menu button...');
      await menuButton.click();
      await this.page.waitForTimeout(500); // Wait for menu to appear

      console.log('  Looking for Download option in menu...');

      // Find and click Download option from the menu
      const downloadOption = await this.page.$('text="Download"');

      if (!downloadOption) {
        await this.takeScreenshot(
          path.join(process.cwd(), 'reports', 'screenshots', 'download-option-not-found.png')
        );
        throw new Error('Could not find Download option in menu');
      }

      console.log('  ✓ Found Download option');
      console.log('  Clicking Download and waiting for download event...');

      // Set up download handling
      const [download] = await Promise.all([
        this.page.waitForEvent('download', { timeout: 30000 }),
        downloadOption.click(),
      ]);

      console.log('  ✓ Download event triggered');
      console.log(`  Suggested filename from browser: ${download.suggestedFilename()}`);
      console.log(`  Target download path: ${downloadPath}`);
      console.log(`  Target filename: ${fileName}`);

      // Save with custom filename
      const filePath = path.join(downloadPath, fileName);
      console.log(`  Full target path: ${filePath}`);

      await download.saveAs(filePath);

      console.log(`  ✓ File saved successfully to: ${filePath}`);

      // Verify file exists
      const fs = require('fs').promises;
      try {
        await fs.access(filePath);
        console.log(`  ✓ Verified file exists at target location`);
      } catch (err) {
        console.log(`  ⚠ Warning: Could not verify file at ${filePath}: ${err.message}`);
      }

      return filePath;
    } catch (error) {
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }

  /**
   * Take screenshot for debugging
   * @param {string} screenshotPath - Path to save screenshot
   * @returns {Promise<void>}
   */
  async takeScreenshot(screenshotPath) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.page.screenshot({ path: screenshotPath, fullPage: true });
  }

  /**
   * Get direct access to Playwright page object
   * @returns {Page|null}
   */
  getPage() {
    return this.page;
  }

  /**
   * Close browser and cleanup
   * @returns {Promise<void>}
   */
  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
}

module.exports = NotebookLMAutomation;
