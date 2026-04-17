// Packages a flat map of { relativePath: content } into a ZIP Buffer.
// Thin wrapper over jszip — isolated so tests and the API route both
// go through one code path and so swapping zip libraries later touches
// exactly one file.

import JSZip from 'jszip';

export async function bundleZip(files) {
  const entries = Object.entries(files);
  if (entries.length === 0) {
    throw new Error('bundleZip: no files to package');
  }
  const zip = new JSZip();
  for (const [relPath, content] of entries) {
    zip.file(relPath, content, { createFolders: false });
  }
  return await zip.generateAsync({ type: 'nodebuffer' });
}
