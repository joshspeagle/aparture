// OAI-PMH ListRecords proxy. Hits https://oaipmh.arxiv.org/oai. Accepts either
// {set, from, until, metadataPrefix, password} for an initial request, or
// {resumptionToken, password} for paginating. Mirrors fetch-arxiv.js shape:
// validates password, surfaces 429/5xx as 429 with upstreamStatus/retryAfter.
// See spec §3.4.

import { checkAccessPassword } from '../../lib/auth/checkAccessPassword.js';

const OAI_HOST = 'https://oaipmh.arxiv.org/oai';

function extractResumptionToken(xml) {
  const match = xml.match(/<resumptionToken[^>]*>([^<]*)<\/resumptionToken>/);
  return match ? match[1].trim() : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password, resumptionToken, set, from, until, metadataPrefix } = req.body ?? {};

  if (!checkAccessPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const params = new URLSearchParams({ verb: 'ListRecords' });
  if (resumptionToken) {
    // Per OAI-PMH spec, when resumptionToken is present, no other params allowed.
    params.set('resumptionToken', resumptionToken);
  } else {
    if (!set || !from || !until || !metadataPrefix) {
      return res
        .status(400)
        .json({ error: 'set, from, until, metadataPrefix required for initial request' });
    }
    params.set('set', set);
    params.set('from', from);
    params.set('until', until);
    params.set('metadataPrefix', metadataPrefix);
  }

  const url = `${OAI_HOST}?${params.toString()}`;
  console.log(`Proxying OAI-PMH request: ${url}`);

  const headers = { 'User-Agent': 'Aparture/1.0 (arXiv paper discovery tool)' };
  const contactEmail = process.env.ARXIV_CONTACT_EMAIL;
  if (contactEmail) headers.From = contactEmail;

  let response;
  try {
    // OAI pages can be slow under load, but a stalled upstream should not pin
    // the route for undici's ~5 min default.
    response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  } catch (err) {
    console.error('OAI proxy network error:', err);
    return res.status(500).json({ error: err.message });
  }

  if (response.status === 429 || response.status >= 500) {
    const retryAfterHeader = response.headers.get('retry-after');
    console.warn(
      `OAI ${response.status}${retryAfterHeader ? ` retry-after=${retryAfterHeader}` : ''}`
    );
    return res.status(429).json({
      error: response.status === 429 ? 'arXiv OAI rate limit' : `arXiv OAI ${response.status}`,
      upstreamStatus: response.status,
      retryAfter: retryAfterHeader ? Number(retryAfterHeader) || null : null,
    });
  }

  if (!response.ok) {
    return res.status(response.status).json({ error: `OAI HTTP ${response.status}` });
  }

  const xml = await response.text();
  const token = extractResumptionToken(xml);

  res.status(200).json({ xml, resumptionToken: token });
}
