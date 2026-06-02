import fs from 'node:fs/promises';
import path from 'node:path';
import { hashInput } from './hash.js';

export async function loadFixtureByHash(hash, dir) {
  const filename = path.join(dir, `${hash}.json`);
  try {
    const raw = await fs.readFile(filename, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.response ?? null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function loadFixture(input, dir) {
  const hash = hashInput(input);
  return loadFixtureByHash(hash, dir);
}
