/**
 * Test PDF Download from arXiv
 *
 * Simple test to fetch a PDF directly from arXiv and check if it's valid
 */

async function testPdfDownload() {
  // Test with a known arXiv paper
  const testPapers = [
    { id: '2301.00001', url: 'https://arxiv.org/pdf/2301.00001.pdf' },
    { id: '2412.14619', url: 'https://arxiv.org/pdf/2412.14619.pdf' },
  ];

  console.log('=== Testing PDF Downloads from arXiv ===\n');

  for (const paper of testPapers) {
    console.log(`Testing paper ${paper.id}...`);
    console.log(`URL: ${paper.url}`);

    try {
      const response = await fetch(paper.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      console.log(`  HTTP Status: ${response.status} ${response.statusText}`);
      console.log(`  Content-Type: ${response.headers.get('content-type')}`);
      console.log(`  Content-Length: ${response.headers.get('content-length')}`);

      if (!response.ok) {
        console.error(`  ❌ Failed to download: ${response.status}`);
        continue;
      }

      const buffer = await response.arrayBuffer();
      const sizeBytes = buffer.byteLength;
      const sizeKB = (sizeBytes / 1024).toFixed(2);
      const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

      console.log(`  Downloaded: ${sizeBytes} bytes (${sizeKB} KB / ${sizeMB} MB)`);

      // Check if it's a valid PDF by looking at the magic bytes
      const uint8 = new Uint8Array(buffer);
      const pdfHeader = String.fromCharCode(...uint8.slice(0, 5));
      console.log(`  PDF Header: ${pdfHeader}`);

      if (pdfHeader === '%PDF-') {
        console.log(`  ✓ Valid PDF format detected`);
      } else {
        console.log(`  ❌ Invalid PDF format (expected '%PDF-', got '${pdfHeader}')`);
      }

      // Convert to base64 and check length
      const base64Data = Buffer.from(buffer).toString('base64');
      console.log(`  Base64 length: ${base64Data.length}`);

      console.log(`  ✓ Successfully downloaded and encoded\n`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }
}

testPdfDownload().catch(console.error);
