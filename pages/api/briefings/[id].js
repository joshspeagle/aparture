import path from 'path';
import fs from 'fs/promises';
import { sweepStaleTmpOrphans } from '../../../lib/persistence/sweepStaleTmp.js';
import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';
import { decodePasswordHeader } from '../../../lib/auth/passwordHeader.js';

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
      console.error('[briefings GET] read failed:', err);
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
        console.error('[briefings DELETE] unlink failed:', err);
        return res.status(500).json({ error: err.message });
      }
      // Idempotent: missing file is fine.
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const { password, patch } = req.body ?? {};
    if (!checkAccessPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'Missing patch' });
    }

    const MUTABLE_FIELDS = new Set(['archived']);
    const safePatch = {};
    for (const [key, value] of Object.entries(patch)) {
      if (MUTABLE_FIELDS.has(key)) safePatch[key] = value;
    }

    try {
      const raw = await fs.readFile(resolved.filePath, 'utf8');
      const current = JSON.parse(raw);
      const merged = { ...current, ...safePatch };
      const serialized = JSON.stringify(merged, null, 2);
      // Unique tmp suffix: concurrent writes for the same id must not
      // interleave on a shared tmp file.
      const tmpPath = `${resolved.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      await sweepStaleTmpOrphans(resolved.dir);
      await fs.writeFile(tmpPath, serialized, 'utf8');
      await fs.rename(tmpPath, resolved.filePath);
      return res.status(200).json({ ok: true });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
      console.error('[briefings PATCH] merge failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
