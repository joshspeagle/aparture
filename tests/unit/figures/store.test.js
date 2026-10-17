import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { figureStem, readFigurePng, saveFigure } from '../../../lib/figures/store.js';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aparture-store-'));
  process.env.APARTURE_REPORTS_DIR = dir;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('figureStem', () => {
  it.each([
    ['2610.12345', '2610.12345'],
    ['2610.12345v2', '2610.12345v2'],
    ['hep-th/9901001', 'hep-th_9901001'],
    ['math.AG/0601001', 'math.AG_0601001'],
    ['../etc/passwd', null],
    ['2610.12345/../x', null],
    ['', null],
    [undefined, null],
  ])('%s → %s', (id, expected) => {
    expect(figureStem(id)).toBe(expected);
  });
});

describe('saveFigure / readFigurePng', () => {
  it('round-trips the image and writes the caption beside it', async () => {
    const png = Buffer.from('\x89PNG fake');
    expect(
      await saveFigure('hep-th/9901001', {
        png,
        label: 'Fig. 2',
        caption: 'Fig. 2. A plot.',
        page: 4,
      })
    ).toBe(true);
    expect(await readFigurePng('hep-th/9901001')).toEqual(png);
    const meta = JSON.parse(
      fs.readFileSync(path.join(dir, 'figures', 'hep-th_9901001.json'), 'utf8')
    );
    expect(meta).toEqual({
      arxivId: 'hep-th/9901001',
      label: 'Fig. 2',
      caption: 'Fig. 2. A plot.',
      page: 4,
    });
    expect(fs.readdirSync(path.join(dir, 'figures')).some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('refuses an id that cannot name a file, and reads nothing for an unknown one', async () => {
    expect(
      await saveFigure('../x', { png: Buffer.from('x'), label: 'Figure 1', caption: '', page: 1 })
    ).toBe(false);
    expect(await readFigurePng('2610.00001')).toBeNull();
  });
});
