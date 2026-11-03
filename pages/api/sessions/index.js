// Sessions cold tier — analyzer-state filesystem store, parallel to
// pages/api/briefings/index.js. Heavy session data (results.allPapers,
// results.scoredPapers, full filterResults arrays) lives here so the
// localStorage hot tier (`arxivAnalyzerState`) stays under quota.
//
// Each save effect rewrites the entire session entry (POST is idempotent +
// atomic via tmp + rename). No PATCH endpoint — the hot tier keeps a
// finalRanking summary, and the cold tier is a write-many target.

import {
  atomicWriteColdJson,
  getColdStoreDir,
  listColdJsonFiles,
  resolveColdFile,
  validateColdId,
} from '../../../lib/persistence/coldStore.js';
import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';
import { decodePasswordHeader } from '../../../lib/auth/passwordHeader.js';

// Next.js' default API body limit is 1mb; a full session payload (allPapers
// + scoredPapers + full filterResults verdicts) for a 600+-paper run is in
// the 7-15 MB range. Raise the limit so cold-tier saves don't 413.
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
    const dir = getColdStoreDir('sessions');
    try {
      const { ids } = await listColdJsonFiles(dir);
      return res.status(200).json({ ids });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(200).json({ ids: [] });
      console.error('[sessions GET list] readdir failed:', err);
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

    const resolved = resolveColdFile('sessions', entry.id);
    if (!resolved) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    try {
      const bytesWritten = await atomicWriteColdJson(resolved.dir, resolved.filePath, entry);
      return res.status(200).json({ id: entry.id, bytesWritten });
    } catch (err) {
      console.error('[sessions POST] write failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
