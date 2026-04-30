// OAI-PMH <record> parser for metadataPrefix=arXiv. Returns null for records
// missing <id> or <created> (caller skips them). See spec §4.4.

const cleanText = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

function getDirectChild(parent, name) {
  for (const child of parent.children) {
    if (child.localName === name || child.tagName === name) return child;
  }
  return null;
}

function getAuthors(arxivEl) {
  const authorsEl = getDirectChild(arxivEl, 'authors');
  if (!authorsEl) return [];
  return Array.from(authorsEl.getElementsByTagName('author'))
    .map((a) => {
      const keyname = a.getElementsByTagName('keyname')[0]?.textContent?.trim() ?? '';
      const forenames = a.getElementsByTagName('forenames')[0]?.textContent?.trim() ?? '';
      return forenames ? `${forenames} ${keyname}`.trim() : keyname;
    })
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
  const arxivEl = metadata.getElementsByTagName('arXiv')[0];
  if (!arxivEl) return null;

  const id = arxivEl.getElementsByTagName('id')[0]?.textContent?.trim();
  const created = arxivEl.getElementsByTagName('created')[0]?.textContent?.trim();
  if (!id || !created) return null;

  const updated = arxivEl.getElementsByTagName('updated')[0]?.textContent?.trim() ?? created;
  const title = cleanText(arxivEl.getElementsByTagName('title')[0]?.textContent ?? '');
  const abstract = cleanText(arxivEl.getElementsByTagName('abstract')[0]?.textContent ?? '');
  const authors = getAuthors(arxivEl);
  const categories = getCategories(arxivEl);

  return {
    id,
    title,
    abstract,
    authors,
    published: created,
    updated,
    categories,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    fetchedCategory: '', // filled in by orchestrator after subcategory matching
  };
}
