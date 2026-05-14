// scripts/probe-arxiv-day.mjs
//
// One-shot OAI probe to validate the count of v1=YYYY-MM-DD papers in a given
// OAI window. Mirrors the harvest the in-app pipeline does for daysBack=1, but
// runs unauthenticated against the public endpoint so it bypasses Aparture's
// proxy and cache.
//
// Usage:  node scripts/probe-arxiv-day.mjs [anchorDate] [lagBufferDays]
//   anchorDate defaults to today's UTC date - 1 (matches pipeline.fetchPapers)
//   lagBufferDays defaults to 7 (matches ANNOUNCE_LAG_BUFFER_DAYS)
//
// Prints:
//   - raw OAI record count per prefix (cs / stat / physics)
//   - v1 date distribution
//   - the would-be anchor day count + v1 distribution
//   - count of papers v1'd on the anchor day attributed to cs.AI as primary

import { JSDOM } from 'jsdom';

const { DOMParser } = new JSDOM().window;

const PREFIXES = ['cs', 'stat', 'physics'];

const anchorArg = process.argv[2];
const lagArg = Number(process.argv[3] ?? 7);

const today = new Date();
today.setUTCDate(today.getUTCDate() - 1);
const until = anchorArg ?? today.toISOString().slice(0, 10);
const fromDate = new Date(`${until}T00:00:00Z`);
fromDate.setUTCDate(fromDate.getUTCDate() - lagArg);
const from = fromDate.toISOString().slice(0, 10);

console.log(`OAI window: ${from} → ${until}  (lagBuffer = ${lagArg} days)`);
console.log('-----');

function rfc2822ToIso(rfc) {
  const ts = Date.parse(rfc);
  return Number.isNaN(ts) ? null : new Date(ts).toISOString().slice(0, 10);
}

function getDirect(parent, name) {
  for (const child of parent.childNodes ?? []) {
    if (child.localName === name || child.tagName === name) return child;
  }
  return null;
}

async function fetchPage(set, resumptionToken = null) {
  const url = resumptionToken
    ? `https://oaipmh.arxiv.org/oai?verb=ListRecords&resumptionToken=${encodeURIComponent(resumptionToken)}`
    : `https://oaipmh.arxiv.org/oai?verb=ListRecords&set=${set}&from=${from}&until=${until}&metadataPrefix=arXivRaw`;
  const res = await globalThis.fetch(url, { headers: { 'User-Agent': 'Aparture/probe-day' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

function parsePage(xml) {
  const doc = new DOMParser({
    locator: {},
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  }).parseFromString(xml, 'text/xml');
  const records = Array.from(doc.getElementsByTagName('record'));
  const papers = [];
  for (const record of records) {
    const metadata = record.getElementsByTagName('metadata')[0];
    if (!metadata) continue;
    const arxivEl = metadata.getElementsByTagName('arXivRaw')[0];
    if (!arxivEl) continue;
    const id = arxivEl.getElementsByTagName('id')[0]?.textContent?.trim();
    if (!id) continue;
    const versionEls = Array.from(arxivEl.getElementsByTagName('version'));
    let v1Date = null;
    for (const v of versionEls) {
      if (v.getAttribute('version') !== 'v1') continue;
      const dateText = v.getElementsByTagName('date')[0]?.textContent?.trim();
      v1Date = rfc2822ToIso(dateText);
      break;
    }
    if (!v1Date) continue;
    const categoriesEl = getDirect(arxivEl, 'categories');
    const categories = categoriesEl
      ? categoriesEl.textContent.trim().split(/\s+/).filter(Boolean)
      : [];
    papers.push({ id, v1Date, categories, primary: categories[0] ?? '' });
  }
  const tokenEl = doc.getElementsByTagName('resumptionToken')[0];
  const token = tokenEl?.textContent?.trim() || null;
  return { papers, token };
}

async function harvestPrefix(set) {
  const all = [];
  let token = null;
  let pages = 0;
  do {
    const xml = await fetchPage(set, token);
    const { papers, token: next } = parsePage(xml);
    all.push(...papers);
    token = next;
    pages += 1;
    if (token) await new Promise((r) => globalThis.setTimeout(r, 3000));
  } while (token);
  return { papers: all, pages };
}

const SELECTED = new Set([
  'cs.AI', 'cs.CL', 'cs.CV', 'cs.IR', 'cs.LG', 'cs.MA', 'cs.NE',
  'stat.AP', 'stat.CO', 'stat.ME', 'stat.ML', 'stat.OT', 'stat.TH',
  'astro-ph.CO', 'astro-ph.EP', 'astro-ph.GA', 'astro-ph.HE', 'astro-ph.IM', 'astro-ph.SR',
]);

const allPapers = [];
for (const set of PREFIXES) {
  process.stdout.write(`Harvesting set=${set}… `);
  const t0 = Date.now();
  const { papers, pages } = await harvestPrefix(set);
  console.log(`${papers.length} records, ${pages} pages, ${Date.now() - t0}ms`);
  allPapers.push(...papers);
}

const byId = new Map();
for (const p of allPapers) {
  if (!byId.has(p.id)) byId.set(p.id, p);
}
const unique = Array.from(byId.values());

const inSelected = unique.filter((p) => p.categories.some((c) => SELECTED.has(c)));

console.log('\n=== Totals ===');
console.log(`Raw records (sum of all 3 prefix fetches): ${allPapers.length}`);
console.log(`Unique IDs: ${unique.length}`);
console.log(`Unique IDs with at least one selected category: ${inSelected.length}`);

console.log('\n=== v1 date distribution (selected only) ===');
const v1Counts = new Map();
for (const p of inSelected) {
  v1Counts.set(p.v1Date, (v1Counts.get(p.v1Date) ?? 0) + 1);
}
for (const [d, n] of [...v1Counts.entries()].sort()) {
  console.log(`  ${d}: ${n}`);
}

const sortedV1 = [...v1Counts.keys()].sort();
const anchor = sortedV1[sortedV1.length - 1];
const anchorPapers = inSelected.filter((p) => p.v1Date === anchor);
const anchorPrimary = anchorPapers.filter((p) => SELECTED.has(p.primary));
const anchorCsAI = anchorPapers.filter((p) => p.primary === 'cs.AI');

console.log(`\n=== Anchor day = ${anchor} ===`);
console.log(`Papers v1'd on anchor (any selected cat): ${anchorPapers.length}`);
console.log(`Papers v1'd on anchor with PRIMARY in selected: ${anchorPrimary.length}`);
console.log(`Papers v1'd on anchor with PRIMARY = cs.AI: ${anchorCsAI.length}`);
