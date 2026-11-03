import path from 'path';
import fs from 'fs/promises';
import { buildIndexEntry } from '../../../lib/briefing/buildIndexEntry.js';
import {
  atomicWriteColdJson,
  getColdStoreDir,
  listColdJsonFiles,
  resolveColdFile,
  validateColdId,
} from '../../../lib/persistence/coldStore.js';
import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';
import { decodePasswordHeader } from '../../../lib/auth/passwordHeader.js';

// Briefing payloads carry heavy optional fields (`pipelineArchive`,
// `fullReportsById`, `quickSummariesById`) that easily blow past Next.js's
// default 4 MB request body limit on a typical 30-paper run. Without this,
// the cold-tier POST 413s and we lose the on-disk copy entirely — which,
// combined with the hot-tier strip-on-quota behavior, means heavy fields
// are gone from both tiers. Mirrors the matching limit on /api/sessions.
export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const password = decodePasswordHeader(req.headers?.['x-aparture-password']);
    if (!checkAccessPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const dir = getColdStoreDir('briefings');
    try {
      const { jsonFiles, ids } = await listColdJsonFiles(dir);

      // ?index=1 returns the rebuildable index slice: lets a client whose
      // localStorage was cleared (or a fresh machine on the same Dropbox-
      // synced disk) repopulate `aparture-briefing-index` without reading
      // every full payload. Corrupt or unreadable files are skipped with
      // a warn so a single bad file doesn't poison the whole list.
      if (req.query.index === '1') {
        const entries = [];
        for (const file of jsonFiles) {
          try {
            const raw = await fs.readFile(path.join(dir, file), 'utf8');
            const parsed = JSON.parse(raw);
            entries.push(buildIndexEntry(parsed));
          } catch (err) {
            console.warn('[briefings GET ?index=1] skipping unreadable file', file, err.message);
          }
        }
        return res.status(200).json({ entries });
      }

      return res.status(200).json({ ids });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(200).json(req.query.index === '1' ? { entries: [] } : { ids: [] });
      }
      console.error('[briefings GET list] readdir failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { password, entry } = req.body ?? {};
    if (!checkAccessPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    if (!entry || typeof entry !== 'object') {
      return res.status(400).json({ error: 'Missing entry' });
    }
    if (!validateColdId(entry.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const resolved = resolveColdFile('briefings', entry.id);
    if (!resolved) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    try {
      const bytesWritten = await atomicWriteColdJson(resolved.dir, resolved.filePath, entry);
      return res.status(200).json({ id: entry.id, bytesWritten });
    } catch (err) {
      console.error('[briefings POST] write failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
