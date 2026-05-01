// scripts/probe-arxiv.mjs
//
// Manual one-shot probe of arXiv's two ingestion endpoints. Prints HTTP code,
// time-to-first-byte, and record count. Run before releases or when something
// looks weird in production. Never run in CI.
//
// Usage:  node scripts/probe-arxiv.mjs

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

async function probe(url, label) {
  const t0 = Date.now();
  let response, body;
  try {
    response = await globalThis.fetch(url, { headers: { 'User-Agent': 'Aparture/probe' } });
    body = await response.text();
  } catch (err) {
    console.log(`${label}: ERROR ${err.message}`);
    return;
  }
  const ms = Date.now() - t0;
  const recordCount = (body.match(/<entry>|<record>/g) ?? []).length;
  console.log(
    `${label}: HTTP ${response.status} | ${ms}ms | ${recordCount} records | ${body.length} bytes`
  );
}

console.log(`Probing arXiv from ${yesterday} to ${today}`);
console.log('-----');

const oaiUrl = `https://oaipmh.arxiv.org/oai?verb=ListRecords&set=cs&from=${yesterday}&until=${today}&metadataPrefix=arXiv`;
const atomUrl = `https://export.arxiv.org/api/query?search_query=%28cat%3Acs.AI%29+AND+submittedDate%3A%5B${yesterday.replaceAll('-', '')}+TO+${today.replaceAll('-', '')}%5D&max_results=10`;

await probe(oaiUrl, 'OAI-PMH');
await probe(atomUrl, 'Atom    ');
