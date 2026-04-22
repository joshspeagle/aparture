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

function resolveFile(id) {
  const dir = getBriefingsDir();
  const filePath = path.join(dir, `${id}.json`);
  if (!filePath.startsWith(dir + path.sep)) return null;
  return { dir, filePath };
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (!validateId(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const resolved = resolveFile(id);
  if (!resolved) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (req.method === 'GET') {
    const password = req.query.password;
    if (password !== process.env.ACCESS_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    try {
      const raw = await fs.readFile(resolved.filePath, 'utf8');
      return res.status(200).json(JSON.parse(raw));
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
      console.error('[briefings GET] read failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const password = req.query.password;
    if (password !== process.env.ACCESS_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    try {
      await fs.unlink(resolved.filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[briefings DELETE] unlink failed:', err);
        return res.status(500).json({ error: err.message });
      }
      // Idempotent: missing file is fine.
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
