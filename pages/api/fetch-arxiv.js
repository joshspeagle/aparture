// API route to proxy arXiv requests (avoids CORS issues)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, maxResults = 300, password } = req.body;

  if (password !== process.env.ACCESS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // No sortBy/sortOrder: arXiv's user manual flags sorted queries as more
    // likely to time out or be throttled. The pipeline sorts client-side.
    const params = new URLSearchParams({
      search_query: query,
      start: 0,
      max_results: maxResults,
    });

    const url = `https://export.arxiv.org/api/query?${params.toString()}`;

    console.log(`Proxying arXiv request: ${query}`);

    const headers = {
      'User-Agent': 'Aparture/1.0 (arXiv paper discovery tool)',
    };
    const contactEmail = process.env.ARXIV_CONTACT_EMAIL;
    if (contactEmail) {
      headers.From = contactEmail;
    }

    const response = await fetch(url, { headers });

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = response.headers.get('retry-after');
      console.warn(`arXiv ${response.status}${retryAfter ? `, Retry-After: ${retryAfter}` : ''}`);
      return res.status(429).json({
        error: response.status === 429 ? 'arXiv rate limit' : `arXiv ${response.status}`,
        upstreamStatus: response.status,
        retryAfter: retryAfter ? Number(retryAfter) || null : null,
      });
    }

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
