// OAI-PMH ListRecords driver. Hits /api/harvest-arxiv, follows resumption
// tokens, retries on 429/5xx, surfaces typed errors. Spec §4.4.

import { parseOaiRecord } from './parseOaiRecord.js';
import { ArxivThrottledError, ArxivNetworkError, ArxivParseError } from './errors.js';

const MAX_RATE_LIMIT_RETRIES = 3;
const BASE_BACKOFF_MS = 5000;
const RETRY_AFTER_CAP_MS = 60_000;
const TOKEN_RETRY_COUNT = 1;

async function fetchPageWithRetry({
  body,
  fetchImpl,
  sleepImpl,
  abortSignal,
  statusCallback,
  setLabel,
}) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    if (abortSignal?.aborted) throw new Error('Operation aborted');

    let response;
    try {
      response = await fetchImpl('/api/harvest-arxiv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ArxivNetworkError(`harvest-arxiv proxy unreachable: ${err.message}`, {
        cause: err,
      });
    }

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const upstream = data.upstreamStatus ?? 429;
      const retryAfterSec = Number(data.retryAfter) || null;
      if (attempt === MAX_RATE_LIMIT_RETRIES) {
        throw new ArxivThrottledError(
          `OAI rate limit exhausted after ${MAX_RATE_LIMIT_RETRIES} retries`,
          { upstreamStatus: upstream, retryAfter: retryAfterSec }
        );
      }
      const baseMs = retryAfterSec ? retryAfterSec * 1000 : BASE_BACKOFF_MS * Math.pow(3, attempt);
      const backoffMs = Math.min(baseMs, RETRY_AFTER_CAP_MS);
      statusCallback(
        `${setLabel}: arXiv ${upstream}, waiting ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`
      );
      await sleepImpl(backoffMs);
      continue;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ArxivNetworkError(data.error || `harvest-arxiv proxy HTTP ${response.status}`);
    }
    return response.json();
  }
  throw new ArxivNetworkError('exhausted retry loop without producing a result');
}

function parseXmlPage(xmlString) {
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'text/xml');
  } catch (err) {
    throw new ArxivParseError(`OAI XML parse error: ${err.message}`);
  }
  const parserErrors = doc.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    throw new ArxivParseError('OAI XML parse error');
  }
  // jsdom doesn't always emit <parsererror>; if root isn't OAI-PMH we treat as parse failure.
  if (
    !doc.getElementsByTagName('OAI-PMH').length &&
    !doc.getElementsByTagName('ListRecords').length
  ) {
    throw new ArxivParseError('OAI XML parse error: no OAI-PMH envelope found');
  }
  // Detect token-expired error: <error code="badResumptionToken">
  const oaiErrors = doc.getElementsByTagName('error');
  for (const err of oaiErrors) {
    if (err.getAttribute('code') === 'badResumptionToken') {
      const e = new ArxivNetworkError('OAI resumption token expired');
      e.tokenExpired = true;
      throw e;
    }
  }
  return doc;
}

/**
 * @param {Object} args
 * @param {string} args.set                            e.g. "cs" or "cs:cs:AI"
 * @param {string} args.from                           YYYY-MM-DD
 * @param {string} args.until                          YYYY-MM-DD
 * @param {string} args.password
 * @param {AbortSignal | {aborted: boolean}} args.abortSignal
 * @param {(msg:string)=>void} [args.statusCallback]
 * @param {typeof fetch} [args.fetchImpl]
 * @param {(ms:number)=>Promise<void>} [args.sleepImpl]
 * @returns {Promise<import('./types.js').Paper[]>}
 */
export async function harvestOai({
  set,
  from,
  until,
  password,
  abortSignal,
  statusCallback = () => {},
  fetchImpl = fetch,
  sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const records = [];
  let resumptionToken = null;
  let tokenRetryAttempts = 0;
  const setLabel = set;

  while (true) {
    if (abortSignal?.aborted) throw new Error('Operation aborted');

    const body = resumptionToken
      ? { resumptionToken, password }
      : { set, from, until, metadataPrefix: 'arXivRaw', password };

    let pageData;
    try {
      pageData = await fetchPageWithRetry({
        body,
        fetchImpl,
        sleepImpl,
        abortSignal,
        statusCallback,
        setLabel,
      });
    } catch (err) {
      if (
        err instanceof ArxivNetworkError &&
        err.tokenExpired &&
        tokenRetryAttempts < TOKEN_RETRY_COUNT
      ) {
        tokenRetryAttempts += 1;
        resumptionToken = null; // restart from scratch
        records.length = 0; // discard partial — we don't know how far we got
        continue;
      }
      throw err;
    }

    let doc;
    try {
      doc = parseXmlPage(pageData.xml);
    } catch (err) {
      if (
        err instanceof ArxivNetworkError &&
        err.tokenExpired &&
        tokenRetryAttempts < TOKEN_RETRY_COUNT
      ) {
        tokenRetryAttempts += 1;
        resumptionToken = null;
        records.length = 0;
        continue;
      }
      throw err;
    }

    const recordEls = doc.getElementsByTagName('record');
    for (const recordEl of recordEls) {
      const paper = parseOaiRecord(recordEl);
      if (paper) records.push(paper);
    }

    resumptionToken = (pageData.resumptionToken ?? '').trim();
    if (!resumptionToken) break;

    // ToU 1 req / 3 s spacing between pages.
    await sleepImpl(3000);
  }

  return records;
}
