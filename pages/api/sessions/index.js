// Sessions cold tier — analyzer-state filesystem store, parallel to
// pages/api/briefings/index.js. Heavy session data (results.allPapers,
// results.scoredPapers, full filterResults arrays) lives here so the
// localStorage hot tier (`arxivAnalyzerState`) stays under quota.
//
// Each save effect rewrites the entire session entry (POST is idempotent +
// atomic via tmp + rename). No PATCH endpoint — the hot tier keeps a
// finalRanking summary, and the cold tier is a write-many target. Phase 2
// migrates the base path to ~/aparture/sessions/ via APARTURE_REPORTS_DIR.

import path from 'path';
import fs from 'fs/promises';
import { sweepStaleTmpOrphans } from '../../../lib/persistence/sweepStaleTmp.js';

// Next.js' default API body limit is 1mb; a full session payload (allPapers
// + scoredPapers + full filterResults verdicts) for a 600+-paper run is in
// the 7-15 MB range. Raise the limit so cold-tier saves don't 413.
export const config = {
  api: {
    bodyParser: { sizeLimit: '20mb' },
  },
};

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function getSessionsDir() {
  const base = process.env.APARTURE_REPORTS_DIR || path.join(process.cwd(), 'reports');
  return path.join(base, 'sessions');
}

function validateId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const password = req.query.password;
    if (password !== process.env.ACCESS_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const dir = getSessionsDir();
    try {
      const files = await fs.readdir(dir);
      const ids = files
        .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
        .map((f) => f.slice(0, -'.json'.length));
      return res.status(200).json({ ids });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(200).json({ ids: [] });
      console.error('[sessions GET list] readdir failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { password, entry } = req.body ?? {};
    if (password !== process.env.ACCESS_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    if (!entry || typeof entry !== 'object') {
      return res.status(400).json({ error: 'Missing entry' });
    }
    if (!validateId(entry.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const dir = getSessionsDir();
    const filePath = path.join(dir, `${entry.id}.json`);
    if (!filePath.startsWith(dir + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    try {
      await fs.mkdir(dir, { recursive: true });
      await sweepStaleTmpOrphans(dir);
      const serialized = JSON.stringify(entry, null, 2);
      const tmpPath = `${filePath}.tmp`;
      await fs.writeFile(tmpPath, serialized, 'utf8');
      await fs.rename(tmpPath, filePath);
      return res
        .status(200)
        .json({ id: entry.id, bytesWritten: Buffer.byteLength(serialized, 'utf8') });
    } catch (err) {
      console.error('[sessions POST] write failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
