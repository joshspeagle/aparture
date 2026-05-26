import path from 'path';
import fs from 'fs/promises';

// Server-side helper for atomic-write directories (`reports/briefings`,
// `reports/sessions`). On WSL/DrvFs (Dropbox-on-Windows), `fs.rename` can
// fail when Windows holds a transient handle on the target file, leaving
// `<id>.json.tmp` orphans behind. Call before a fresh atomic write so a
// crashed-rename run doesn't accumulate forever.

const DEFAULT_STALE_MS = 5 * 60 * 1000;

export async function sweepStaleTmpOrphans(dir, { staleMs = DEFAULT_STALE_MS } = {}) {
  try {
    const files = await fs.readdir(dir);
    const now = Date.now();
    await Promise.all(
      files
        .filter((f) => f.endsWith('.tmp'))
        .map(async (f) => {
          const p = path.join(dir, f);
          try {
            const stat = await fs.stat(p);
            if (now - stat.mtimeMs > staleMs) await fs.unlink(p);
          } catch {
            // Races with concurrent writers are fine to ignore.
          }
        })
    );
  } catch {
    // Directory may not exist yet on first write — caller mkdirs.
  }
}
