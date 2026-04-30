// lib/arxiv/types.js
//
// Shared type contracts for the arxiv ingestion layer. JSDoc-only; no
// runtime code. See docs/superpowers/specs/2026-04-29-arxiv-ingestion-design.md
// §3.2 for rationale.

/**
 * @typedef {Object} Paper
 * @property {string} id                     Versionless arXiv ID, e.g. "2504.12345".
 * @property {string} title
 * @property {string} abstract
 * @property {string[]} authors
 * @property {string} published              ISO; first-version submission date.
 * @property {string} updated                ISO; last-update date.
 * @property {string[]} categories           e.g. ["cs.AI", "cs.LG"].
 * @property {string} pdfUrl                 e.g. "https://arxiv.org/pdf/<id>".
 * @property {string} fetchedCategory        Selected subcategory we attribute this paper to.
 */

/**
 * @typedef {'auto' | 'oai-only' | 'atom-only'} IngestionMode
 */

/**
 * @typedef {'submitted-only' | 'submitted-or-updated'} WindowSemantics
 */

/**
 * @typedef {Object} HarvestWindow
 * @property {string} from                            YYYY-MM-DD inclusive.
 * @property {string} until                           YYYY-MM-DD inclusive.
 * @property {string[]} selectedSubcategories         e.g. ["cs.AI", "cs.LG", "stat.ML"].
 * @property {number[]} fillupSchedule                Cumulative extra-day offsets, e.g. [3, 7, 14].
 * @property {number} minPapersPerSubcategory         Threshold; 0 disables fill-ups.
 * @property {IngestionMode} mode
 * @property {WindowSemantics} windowSemantics
 * @property {number} cacheTtlMinutes                 0 disables caching.
 */

/**
 * @typedef {Object} HarvestPerPrefixEntry
 * @property {string} prefix                          Top-level OAI set, e.g. "cs".
 * @property {'oai' | 'atom' | 'cache'} driver
 * @property {number} pages                           OAI pages traversed (0 for atom/cache).
 * @property {number} records                         Raw record count returned.
 * @property {number} spentMs
 * @property {boolean} cached
 */

/**
 * @typedef {Object} HarvestFillupEntry
 * @property {string} subcategory                     e.g. "cs.GT".
 * @property {number} triggeredAt                     Count when fill-up fired.
 * @property {number} finalCount                      Count after fill-up.
 * @property {number} stepsUsed                       Number of fillupSchedule steps consumed.
 */

/**
 * @typedef {Object} HarvestResult
 * @property {Paper[]} papers
 * @property {HarvestPerPrefixEntry[]} perPrefix
 * @property {HarvestFillupEntry[]} fillups
 * @property {'auto-oai' | 'auto-mixed' | 'auto-atom' | 'oai-only' | 'atom-only'} modeUsed
 *   Distinguishes what was requested (IngestionMode) from what actually ran. The `auto-*`
 *   variants only appear when `mode: 'auto'`, recording whether OAI succeeded for every
 *   prefix (auto-oai), some prefixes (auto-mixed), or none (auto-atom).
 */

export {};
