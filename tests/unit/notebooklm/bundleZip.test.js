import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { bundleZip } from '../../../lib/notebooklm/bundleZip.js';

describe('bundleZip', () => {
  it('packages a files map into a ZIP Buffer that round-trips cleanly', async () => {
    const files = {
      'briefing.md': '# Briefing\n',
      'discussion-guide.md': '# Guide\n',
      'papers/01-foo.md': '# Paper 1\n',
      'papers/02-bar.md': '# Paper 2\n',
      'focus-prompt.txt': 'Paste me.',
      'INSTRUCTIONS.md': '# Read me.',
    };
    const buf = await bundleZip(files);
    expect(Buffer.isBuffer(buf)).toBe(true);

    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      'INSTRUCTIONS.md',
      'briefing.md',
      'discussion-guide.md',
      'focus-prompt.txt',
      'papers/01-foo.md',
      'papers/02-bar.md',
    ]);
    expect(await zip.file('briefing.md').async('string')).toBe('# Briefing\n');
    expect(await zip.file('papers/02-bar.md').async('string')).toBe('# Paper 2\n');
  });

  it('rejects empty files map', async () => {
    await expect(bundleZip({})).rejects.toThrow(/no files/i);
  });
});
