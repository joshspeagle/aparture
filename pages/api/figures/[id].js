import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';
import { decodePasswordHeader } from '../../../lib/auth/passwordHeader.js';
import { figureStem, readFigurePng } from '../../../lib/figures/store.js';

// Serves a paper's key figure, cropped by /api/analyze-pdf. The id is the
// arXiv ID, percent-encoded by the client (old-style IDs carry a slash).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const id = req.query.id;
  if (!figureStem(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  // Auth via request header, as for the briefing files: a query-string
  // password would land in server logs and browser history.
  const password = decodePasswordHeader(req.headers?.['x-aparture-password']);
  if (!checkAccessPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  try {
    const png = await readFigurePng(id);
    if (!png) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(200).send(png);
  } catch (err) {
    console.error('[figures GET] read failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
