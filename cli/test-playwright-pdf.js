/**
 * Test Playwright PDF Download from arXiv
 *
 * Quick test to verify Playwright can download PDFs through browser automation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testPlaywrightPdfDownload() {
    console.log('=== Testing Playwright PDF Download from arXiv ===\n');

    // Launch with persistent context to maintain cookies/session
    // This will open a browser with persistent session data
    const userDataDir = path.join(__dirname, '..', 'temp', 'playwright-profile');

    console.log('Launching browser with persistent session...');
    console.log('If you see reCAPTCHA, solve it and the session will be saved.\n');

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        acceptDownloads: true
    });
    const page = context.pages()[0] || await context.newPage();

    try {
        // Test with a known paper
        const arxivId = '2301.00001';
        const arxivUrl = `https://arxiv.org/abs/${arxivId}`;

        console.log(`Navigating to arXiv page: ${arxivUrl}`);
        await page.goto(arxivUrl, { waitUntil: 'domcontentloaded' });

        console.log('Getting PDF download URL...');

        // Get the PDF URL from the download link
        const pdfUrl = await page.getAttribute('a.download-pdf', 'href');
        console.log(`PDF URL: ${pdfUrl}`);

        // Make the full URL if it's relative
        const fullPdfUrl = pdfUrl.startsWith('http') ? pdfUrl : `https://arxiv.org${pdfUrl}`;
        console.log(`Fetching PDF via browser context (with session cookies): ${fullPdfUrl}`);

        // Use page.request to fetch with browser's cookies/session
        const response = await context.request.get(fullPdfUrl);

        console.log(`PDF response received: ${response.status()}`);
        console.log(`Content-Type: ${response.headers()['content-type']}`);

        // Get the PDF data from the response
        const pdfBuffer = await response.body();
        console.log(`Captured PDF data: ${pdfBuffer.length} bytes`);

        // Save to temporary location
        const downloadPath = path.join(__dirname, '..', 'temp', `${arxivId}.pdf`);

        // Ensure temp directory exists
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.writeFileSync(downloadPath, pdfBuffer);
        console.log(`PDF saved to: ${downloadPath}`);

        // Check if it's a valid PDF
        const stats = fs.statSync(downloadPath);
        const sizeBytes = stats.size;
        const sizeKB = (sizeBytes / 1024).toFixed(2);
        const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

        console.log(`\nFile size: ${sizeBytes} bytes (${sizeKB} KB / ${sizeMB} MB)`);

        // Check PDF magic bytes
        const buffer = fs.readFileSync(downloadPath);
        const header = buffer.slice(0, 5).toString('ascii');

        if (header === '%PDF-') {
            console.log('✓ Valid PDF format detected!');
            console.log(`✓ Successfully downloaded ${sizeMB} MB PDF via Playwright\n`);

            // Show base64 length for comparison
            const base64 = buffer.toString('base64');
            console.log(`Base64 length: ${base64.length} characters`);

            return true;
        } else {
            console.log(`❌ Invalid PDF format (expected '%PDF-', got '${header}')`);
            return false;
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    } finally {
        await context.close();
    }
}

testPlaywrightPdfDownload()
    .then(success => {
        if (success) {
            console.log('\n✅ Playwright PDF download successful!');
            process.exit(0);
        } else {
            console.log('\n❌ Playwright PDF download failed');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
