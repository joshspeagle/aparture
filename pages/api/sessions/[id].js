import fs from 'fs/promises';
import { resolveColdFile, validateColdId } from '../../../lib/persistence/coldStore.js';
import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';
import { decodePasswordHeader } from '../../../lib/auth/passwordHeader.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!validateColdId(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const resolved = resolveColdFile('sessions', id);
  if (!resolved) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  if (req.method === 'GET') {
    const password = decodePasswordHeader(req.headers?.['x-aparture-password']);
    if (!checkAccessPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    try {
      const raw = await fs.readFile(resolved.filePath, 'utf8');
      return res.status(200).json(JSON.parse(raw));
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
      console.error('[sessions GET] read failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const password = decodePasswordHeader(req.headers?.['x-aparture-password']);
    if (!checkAccessPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    try {
      await fs.unlink(resolved.filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('[sessions DELETE] unlink failed:', err);
        return res.status(500).json({ error: err.message });
      }
      // Idempotent: missing file is fine.
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
