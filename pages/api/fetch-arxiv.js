// API route to proxy arXiv requests (avoids CORS issues)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, maxResults = 300 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const params = new URLSearchParams({
      search_query: query,
      start: 0,
      max_results: maxResults,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    });

    const url = `https://export.arxiv.org/api/query?${params.toString()}`;

    console.log(`Proxying arXiv request: ${query}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Aparture/1.0 (arXiv paper discovery tool)',
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API returned ${response.status}`);
    }

    const text = await response.text();

    res.status(200).json({ xml: text });
  } catch (error) {
    console.error('arXiv proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
