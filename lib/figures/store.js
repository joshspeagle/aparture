// Key figures on disk: reports/figures/<arxivId>.png beside a .json with the
// label, caption and page. Keyed by arXiv ID rather than briefing, since the
// same paper's figure serves every briefing that cites it; like briefing
// files, they are removed only by hand. Server-only.

import fs from 'node:fs/promises';
import path from 'node:path';

// New-style IDs (2610.12345, optional version) and old-style ones
// (hep-th/9901001); the slash becomes an underscore in the file name.
const ARXIV_ID = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/;

export function figuresDir() {
  const base = process.env.APARTURE_REPORTS_DIR || path.join(process.cwd(), 'reports');
  return path.join(base, 'figures');
}

/** The file stem for an arXiv ID, or null when the ID isn't one. */
export function figureStem(arxivId) {
  if (typeof arxivId !== 'string' || !ARXIV_ID.test(arxivId)) return null;
  return arxivId.replace('/', '_');
}

async function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

/**
 * @param {string} arxivId
 * @param {{png: Buffer, label: string, caption: string, page: number}} figure
 * @returns {Promise<boolean>} false when the ID can't name a file
 */
export async function saveFigure(arxivId, { png, label, caption, page }) {
  const stem = figureStem(arxivId);
  if (!stem) return false;
  const dir = figuresDir();
  await fs.mkdir(dir, { recursive: true });
  await writeAtomic(path.join(dir, `${stem}.png`), png);
  await writeAtomic(
    path.join(dir, `${stem}.json`),
    JSON.stringify({ arxivId, label, caption, page }, null, 2)
  );
  return true;
}

/** The PNG bytes for an arXiv ID, or null when none is stored. */
export async function readFigurePng(arxivId) {
  const stem = figureStem(arxivId);
  if (!stem) return null;
  try {
    return await fs.readFile(path.join(figuresDir(), `${stem}.png`));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
