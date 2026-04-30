// Atom <entry> parser for the legacy /api/query path. Adapted from
// lib/analyzer/pipeline.js parseArxivEntry. Returns null for entries without
// a recoverable arXiv id; the legacy code returned undefined and could throw
// on a malformed <id> missing "/abs/". See spec §4.5.

const cleanText = (text) => (text || '').replace(/\s+/g, ' ').trim();

function getId(entry) {
  const id = entry.getElementsByTagName('id')[0]?.textContent;
  if (!id) return '';
  const extracted = id.split('/abs/')[1] ?? '';
  // Strip trailing .pdf and version suffixes (v1, v2, ...).
  return extracted.replace(/\.pdf$/, '').replace(/v\d+$/, '');
}

function getAuthors(entry) {
  const authorElements = entry.getElementsByTagName('author');
  return Array.from(authorElements)
    .map((a) => a.getElementsByTagName('name')[0]?.textContent || '')
    .filter(Boolean);
}

function getCategories(entry) {
  const categories = entry.getElementsByTagName('category');
  return Array.from(categories)
    .map((c) => c.getAttribute('term'))
    .filter(Boolean);
}

/**
 * @param {Element} entry             Atom <entry> DOM element
 * @param {string}  fetchedCategory   The selected subcategory we attribute this paper to
 * @returns {import('./types.js').Paper | null}
 */
export function parseAtomEntry(entry, fetchedCategory) {
  const id = getId(entry);
  if (!id) return null;

  return {
    id,
    title: cleanText(entry.getElementsByTagName('title')[0]?.textContent || ''),
    abstract: cleanText(entry.getElementsByTagName('summary')[0]?.textContent || ''),
    authors: getAuthors(entry),
    published: entry.getElementsByTagName('published')[0]?.textContent || '',
    updated: entry.getElementsByTagName('updated')[0]?.textContent || '',
    categories: getCategories(entry),
    pdfUrl: `https://export.arxiv.org/pdf/${id}.pdf`,
    fetchedCategory,
  };
}
