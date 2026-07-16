import path from 'path';
import fs from 'fs/promises';
import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';
import { decodePasswordHeader } from '../../../lib/auth/passwordHeader.js';

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function getSessionsDir() {
  const base = process.env.APARTURE_REPORTS_DIR || path.join(process.cwd(), 'reports');
  return path.join(base, 'sessions');
}

function validateId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

function resolveFile(id) {
  const dir = getSessionsDir();
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
    // Auth via request header, NOT the query string — `?password=` leaks
    // into dev-server logs and browser history.
    // Header values are percent-encoded by the client (fetch's ByteString
    // constraint rejects non-Latin1 chars); decode before comparing.
    // Malformed encoding decodes to null -> wrong password -> 401.
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
    // Auth via request header, NOT the query string — `?password=` leaks
    // into dev-server logs and browser history.
    // Header values are percent-encoded by the client (fetch's ByteString
    // constraint rejects non-Latin1 chars); decode before comparing.
    // Malformed encoding decodes to null -> wrong password -> 401.
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
