// OAI-PMH <record> parser for metadataPrefix=arXivRaw. Returns null for
// records missing <id> or a parseable v1 <date>.
//
// Why arXivRaw and not arXiv: arXiv's `arXiv` metadata format puts an
// announcement-related date in <created> that does NOT correspond to v1
// submission. Re-announced papers (v2+ that re-trigger announcement)
// surface a <created> date in the current OAI window even though their
// original submission predates it, defeating `submitted-only`. arXivRaw
// exposes a <version version="vN"><date> per version, so we can take v1's
// date as the canonical published date.

import { ArxivParseError } from './errors.js';

const cleanText = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

function getDirectChild(parent, name) {
  for (const child of parent.children) {
    if (child.localName === name || child.tagName === name) return child;
  }
  return null;
}

// Parses RFC-2822 date ("Mon, 18 Sep 2023 07:56:40 GMT") to YYYY-MM-DD UTC.
function rfc2822ToIsoDate(rfc) {
  if (!rfc) return null;
  const ts = Date.parse(rfc);
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

// arXivRaw <authors> is a single comma/and-separated string. Splits on commas
// and " and " and trims; affiliations in parens are kept inline since we don't
// rely on author normalisation downstream.
function parseAuthorsString(text) {
  if (!text) return [];
  return cleanText(text)
    .split(/,\s*|\s+and\s+/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function getCategories(arxivEl) {
  const categoriesEl = getDirectChild(arxivEl, 'categories');
  if (!categoriesEl) return [];
  return categoriesEl.textContent.trim().split(/\s+/).filter(Boolean);
}

/**
 * @param {Element} record   OAI-PMH <record> element
 * @returns {import('./types.js').Paper | null}
 */
export function parseOaiRecord(record) {
  const metadata = record.getElementsByTagName('metadata')[0];
  if (!metadata) return null;
  const arxivEl = metadata.getElementsByTagName('arXivRaw')[0];
  if (!arxivEl) return null;

  const id = arxivEl.getElementsByTagName('id')[0]?.textContent?.trim();
  if (!id) return null;

  const versionEls = Array.from(arxivEl.getElementsByTagName('version'));
  if (versionEls.length === 0) {
    throw new ArxivParseError(`OAI arXivRaw record ${id} has no <version> elements`);
  }

  let v1Date = null;
  let latestDate = null;
  for (const v of versionEls) {
    const seq = v.getAttribute('version');
    const dateText = v.getElementsByTagName('date')[0]?.textContent?.trim();
    const iso = rfc2822ToIsoDate(dateText);
    if (!iso) continue;
    if (seq === 'v1') v1Date = iso;
    if (latestDate === null || iso > latestDate) latestDate = iso;
  }
  if (!v1Date) return null;

  const title = cleanText(arxivEl.getElementsByTagName('title')[0]?.textContent ?? '');
  const abstract = cleanText(arxivEl.getElementsByTagName('abstract')[0]?.textContent ?? '');
  const authors = parseAuthorsString(arxivEl.getElementsByTagName('authors')[0]?.textContent ?? '');
  const categories = getCategories(arxivEl);

  return {
    id,
    title,
    abstract,
    authors,
    published: v1Date,
    updated: latestDate ?? v1Date,
    categories,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    fetchedCategory: '',
  };
}
