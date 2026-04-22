import path from 'path';
import fs from 'fs/promises';

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function getBriefingsDir() {
  const base = process.env.APARTURE_REPORTS_DIR || path.join(process.cwd(), 'reports');
  return path.join(base, 'briefings');
}

function validateId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export default async function handler(req, res) {
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
