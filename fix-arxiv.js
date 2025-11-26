const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components/ArxivAnalyzer.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix: Replace direct arXiv fetch with proxy using regex
// This is more robust than exact string matching
const oldPattern =
  /\/\/ Build URL with proper encoding\s+const params = new URLSearchParams\(\{[\s\S]*?\}\);\s+const url = `https:\/\/export\.arxiv\.org\/api\/query\?\$\{params\.toString\(\)\}`;\s+console\.log\(` {2}Query: \$\{query\}`\);\s+console\.log\(` {2}URL length: \$\{url\.length\} chars`\);\s+\/\/ Use abort controller signal in fetch\s+const response = await fetch\(url, \{\s+signal: abortControllerRef\.current\?\.signal,\s+\}\);\s+if \(!response\.ok\) \{\s+throw new Error\(`arXiv API HTTP error: \$\{response\.status\}`\);\s+\}\s+const text = await response\.text\(\);/;

const newCode = `console.log(\`  Query: \${query}\`);

    // Use server-side proxy to avoid CORS issues
    const response = await fetch('/api/fetch-arxiv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, maxResults }),
      signal: abortControllerRef.current?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || \`arXiv API HTTP error: \${response.status}\`);
    }

    const data = await response.json();
    const text = data.xml;`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newCode);
  console.log('Fix applied: arXiv fetch now uses proxy');
} else if (content.includes("fetch('/api/fetch-arxiv'")) {
  console.log('Fix already applied (proxy already in use)');
} else {
  console.log('WARNING: Pattern not found - manual fix may be needed');
  console.log('Looking for export.arxiv.org...');
  if (content.includes('export.arxiv.org')) {
    console.log('Found direct arXiv URL - needs manual replacement');
  }
}

fs.writeFileSync(filePath, content);
console.log('Done!');
