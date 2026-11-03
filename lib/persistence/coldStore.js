import path from 'path';
import fs from 'fs/promises';
import { sweepStaleTmpOrphans } from './sweepStaleTmp.js';

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Return the cold-storage directory path for a given subdirectory
 * (`'briefings'` or `'sessions'`).
 *
 * @param {string} subdir
 * @returns {string}
 */
export function getColdStoreDir(subdir) {
  const base = process.env.APARTURE_REPORTS_DIR || path.join(process.cwd(), 'reports');
  return path.join(base, subdir);
}

/**
 * Validate a cold-storage entry ID against path-traversal characters.
 *
 * @param {unknown} id
 * @returns {boolean}
 */
export function validateColdId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/**
 * Resolve and validate the file path for a cold-storage entry ID.
 * Returns `null` when the resolved path escapes the target directory.
 *
 * @param {string} subdir
 * @param {string} id
 * @returns {{ dir: string, filePath: string } | null}
 */
export function resolveColdFile(subdir, id) {
  const dir = getColdStoreDir(subdir);
  const filePath = path.join(dir, `${id}.json`);
  if (!filePath.startsWith(dir + path.sep)) return null;
  return { dir, filePath };
}

/**
 * List `.json` files (excluding `.tmp` files) and their stripped IDs in a
 * cold-storage directory.
 *
 * @param {string} dir
 * @returns {Promise<{ jsonFiles: string[], ids: string[] }>}
 */
export async function listColdJsonFiles(dir) {
  const files = await fs.readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'));
  const ids = jsonFiles.map((f) => f.slice(0, -'.json'.length));
  return { jsonFiles, ids };
}

/**
 * Atomically write a JSON payload to `filePath` inside `dir` via a unique
 * temporary file and `rename`, sweeping stale orphan `.tmp` files first.
 *
 * @param {string} dir
 * @param {string} filePath
 * @param {unknown} payload
 * @returns {Promise<number>} UTF-8 byte length written.
 */
export async function atomicWriteColdJson(dir, filePath, payload) {
  await fs.mkdir(dir, { recursive: true });
  await sweepStaleTmpOrphans(dir);
  const serialized = JSON.stringify(payload, null, 2);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmpPath, serialized, 'utf8');
  await fs.rename(tmpPath, filePath);
  return Buffer.byteLength(serialized, 'utf8');
}
