import path from 'path';
import fs from 'fs/promises';
import { buildIndexEntry } from '../../../lib/briefing/buildIndexEntry.js';
import { sweepStaleTmpOrphans } from '../../../lib/persistence/sweepStaleTmp.js';
import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';

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

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function getBriefingsDir() {
  const base = process.env.APARTURE_REPORTS_DIR || path.join(process.cwd(), 'reports');
  return path.join(base, 'briefings');
}

function validateId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const password = req.query.password;
    if (!checkAccessPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const dir = getBriefingsDir();
    try {
      const files = await fs.readdir(dir);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'));
      const ids = jsonFiles.map((f) => f.slice(0, -'.json'.length));

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
    if (!validateId(entry.id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const dir = getBriefingsDir();
    const filePath = path.join(dir, `${entry.id}.json`);
    if (!filePath.startsWith(dir + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    try {
      await fs.mkdir(dir, { recursive: true });
      await sweepStaleTmpOrphans(dir);
      const serialized = JSON.stringify(entry, null, 2);
      // Unique tmp suffix: concurrent writes for the same id (debounced save
      // effects re-fire frequently) must not interleave on a shared tmp file.
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      await fs.writeFile(tmpPath, serialized, 'utf8');
      await fs.rename(tmpPath, filePath);
      return res
        .status(200)
        .json({ id: entry.id, bytesWritten: Buffer.byteLength(serialized, 'utf8') });
    } catch (err) {
      console.error('[briefings POST] write failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
