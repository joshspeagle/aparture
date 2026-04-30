// lib/arxiv/sets.js
//
// Hand-mapped subcategory ↔ OAI-PMH set string lookup.
//
// arXiv's OAI set hierarchy is *almost* `<group>:<archive>:<CATEGORY>`, with
// physics being multi-level (e.g. `physics:astro-ph:HE`) and most archives
// being single-level (e.g. `cs:cs:AI`). This map is hand-curated rather than
// driven by ListSets introspection — the category list is stable and a
// network-bound startup probe adds more failure modes than it solves.
// See spec §3.3.

import { ArxivUnknownCategoryError } from './errors.js';

// archive (the leading "physics" group is implicit by membership in this set).
const PHYSICS_ARCHIVES = new Set([
  'astro-ph',
  'cond-mat',
  'gr-qc',
  'hep-ex',
  'hep-lat',
  'hep-ph',
  'hep-th',
  'math-ph',
  'nlin',
  'nucl-ex',
  'nucl-th',
  'physics',
  'quant-ph',
]);

// archives that are themselves the prefix (cs.AI → prefix "cs", archive "cs")
const FLAT_PREFIXES = new Set(['cs', 'econ', 'eess', 'math', 'q-bio', 'q-fin', 'stat']);

function splitSubcategory(subcategory) {
  // Returns { archive, category } where archive is e.g. "cs", "astro-ph", "hep-th",
  // and category is e.g. "AI", "HE", or null when the archive *is* the category.
  const dotIdx = subcategory.indexOf('.');
  if (dotIdx === -1) {
    return { archive: subcategory, category: null };
  }
  return {
    archive: subcategory.slice(0, dotIdx),
    category: subcategory.slice(dotIdx + 1),
  };
}

export function prefixOf(subcategory) {
  const { archive } = splitSubcategory(subcategory);
  if (FLAT_PREFIXES.has(archive)) return archive;
  if (PHYSICS_ARCHIVES.has(archive)) return 'physics';
  return null;
}

export function narrowSetOf(subcategory) {
  const { archive, category } = splitSubcategory(subcategory);
  const prefix = prefixOf(subcategory);
  if (!prefix) return null;
  if (category === null) {
    // e.g. "hep-th" → "physics:hep-th"
    return `${prefix}:${archive}`;
  }
  return `${prefix}:${archive}:${category}`;
}

export function groupByPrefix(subcategories) {
  const groups = {};
  for (const sc of subcategories) {
    const prefix = prefixOf(sc);
    if (!prefix) throw new ArxivUnknownCategoryError(sc);
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(sc);
  }
  return groups;
}
