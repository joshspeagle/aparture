// Driver for arXiv's legacy Atom /api/query endpoint. One subcategory per
// call. Used as the fallback path when OAI-PMH fails (or as the primary
// path when arxivIngestion === 'atom-only'). Spec §4.5.
//
// Pure-ish: takes injectable fetch and sleep so tests can run without
// timers/network. Uses the global DOMParser (provided by jsdom in tests,
// by the browser in production).

import { parseAtomEntry } from './parseAtomEntry.js';
import { ArxivThrottledError, ArxivNetworkError, ArxivParseError } from './errors.js';

const MAX_RATE_LIMIT_RETRIES = 3;
const BASE_BACKOFF_MS = 5000;
const RETRY_AFTER_CAP_MS = 60_000;

function buildQuery(subcategory, from, until) {
  const fromCompact = from.replaceAll('-', '');
  const untilCompact = until.replaceAll('-', '');
  return `(cat:${subcategory}) AND submittedDate:[${fromCompact} TO ${untilCompact}]`;
}

/**
 * @param {Object} args
 * @param {string} args.subcategory
 * @param {string} args.from                  YYYY-MM-DD
 * @param {string} args.until                 YYYY-MM-DD
 * @param {string} args.password
 * @param {AbortSignal | {aborted: boolean}} args.abortSignal   A real AbortSignal in
 *   production (so an in-flight fetch is canceled, matching legacy behavior); a duck
 *   `{aborted}` is acceptable for tests where fetchImpl is mocked.
 * @param {(msg: string) => void} [args.statusCallback]
 * @param {typeof fetch} [args.fetchImpl]     defaults to global fetch
 * @param {(ms:number) => Promise<void>} [args.sleepImpl]  defaults to setTimeout
 * @returns {Promise<import('./types.js').Paper[]>}
 */
export async function fetchAtom({
  subcategory,
  from,
  until,
  password,
  abortSignal,
  statusCallback = () => {},
  fetchImpl = fetch,
  sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const query = buildQuery(subcategory, from, until);

  // Pass abortSignal to fetch ONLY when it's a real AbortSignal; the duck-typed
  // {aborted: boolean} test stand-in is not assignable to RequestInit.signal and
  // would throw a runtime TypeError if forwarded. globalThis.AbortSignal keeps the
  // check working in any environment that has the constructor.
  const fetchSignal =
    typeof globalThis.AbortSignal !== 'undefined' && abortSignal instanceof globalThis.AbortSignal
      ? abortSignal
      : undefined;

  let data;
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    if (abortSignal?.aborted) throw new Error('Operation aborted');

    let response;
    try {
      response = await fetchImpl('/api/fetch-arxiv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxResults: 300, password }),
        signal: fetchSignal,
      });
    } catch (err) {
      // A real AbortSignal abort surfaces here as DOMException(AbortError); preserve
      // the original "Operation aborted" Error so callers can recognize it uniformly.
      if (err?.name === 'AbortError') throw new Error('Operation aborted');
      throw new ArxivNetworkError(`fetch-arxiv proxy unreachable: ${err.message}`, { cause: err });
    }

    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}));
      const upstreamStatus = errorData.upstreamStatus ?? 429;
      const retryAfterSec = Number(errorData.retryAfter) || null;
      if (attempt === MAX_RATE_LIMIT_RETRIES) {
        throw new ArxivThrottledError(
          `arXiv rate limit: exhausted ${MAX_RATE_LIMIT_RETRIES} retries`,
          { upstreamStatus, retryAfter: retryAfterSec }
        );
      }
      const baseMs = retryAfterSec ? retryAfterSec * 1000 : BASE_BACKOFF_MS * Math.pow(3, attempt);
      const backoffMs = Math.min(baseMs, RETRY_AFTER_CAP_MS);
      statusCallback(
        `${subcategory}: arXiv ${upstreamStatus}, waiting ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`
      );
      await sleepImpl(backoffMs);
      continue;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ArxivNetworkError(errorData.error || `arXiv proxy HTTP ${response.status}`);
    }

    data = await response.json();
    break;
  }

  let xmlDoc;
  try {
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(data.xml, 'text/xml');
  } catch (err) {
    throw new ArxivParseError(`Atom XML parse error: ${err.message}`);
  }

  const parseErrors = xmlDoc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    throw new ArxivParseError('Atom XML parse error');
  }

  const errorElements = xmlDoc.getElementsByTagName('error');
  if (errorElements.length > 0) {
    throw new ArxivParseError(`arXiv API error: ${errorElements[0].textContent}`);
  }

  const entries = xmlDoc.getElementsByTagName('entry');
  const papers = [];
  for (const entry of entries) {
    if (abortSignal?.aborted) throw new Error('Operation aborted');
    try {
      const paper = parseAtomEntry(entry, subcategory);
      if (paper) papers.push(paper);
    } catch (err) {
      console.warn('parseAtomEntry threw:', err);
    }
  }
  return papers;
}
