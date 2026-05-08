import path from 'path';
import fs from 'fs/promises';

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
    if (password !== process.env.ACCESS_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const dir = getBriefingsDir();
    try {
      const files = await fs.readdir(dir);
      const ids = files
        .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
        .map((f) => f.slice(0, -'.json'.length));
      return res.status(200).json({ ids });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(200).json({ ids: [] });
      console.error('[briefings GET list] readdir failed:', err);
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

    const dir = getBriefingsDir();
    const filePath = path.join(dir, `${entry.id}.json`);
    if (!filePath.startsWith(dir + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    try {
      await fs.mkdir(dir, { recursive: true });
      const serialized = JSON.stringify(entry, null, 2);
      const tmpPath = `${filePath}.tmp`;
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
