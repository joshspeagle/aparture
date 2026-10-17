import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cropFigure, figureNumber } from '../../../lib/figures/cropFigure.js';

// One page: a paragraph, a line chart, its caption, more text, and a body
// sentence that mentions "Figure 1" mid-paragraph.
const PDF = fs.readFileSync(path.resolve(__dirname, '../../fixtures/pdf/figure.pdf'));

describe('figureNumber', () => {
  it.each([
    ['Figure 3', '3'],
    ['Fig. 2', '2'],
    ['FIG. 12', '12'],
    ['Figure S2', 'S2'],
    ['Table 1', null],
    ['', null],
    [null, null],
  ])('%s → %s', (label, expected) => {
    expect(figureNumber(label)).toBe(expected);
  });
});

describe('cropFigure', () => {
  it('crops the figure above its caption and returns the caption verbatim', async () => {
    const crop = await cropFigure(PDF, 'Figure 1');
    expect(crop).not.toBeNull();
    expect(crop.page).toBe(1);
    expect(crop.caption).toBe(
      'Figure 1. Recovered population versus the injected one, for every bin of the survey.'
    );
    expect(crop.png.subarray(1, 4).toString('ascii')).toBe('PNG');
    // The chart is 420x220 CSS px at 2x; the crop holds it and stops at the
    // paragraph above, whose last line is short.
    expect(crop.width).toBeGreaterThan(500);
    expect(crop.width).toBeLessThan(1000);
    expect(crop.height).toBeGreaterThan(250);
    expect(crop.height).toBeLessThan(500);
  });

  it('accepts the abbreviated label', async () => {
    expect((await cropFigure(PDF, 'Fig. 1'))?.page).toBe(1);
  });

  it('returns null for a figure the paper does not have', async () => {
    expect(await cropFigure(PDF, 'Figure 2')).toBeNull();
  });

  it('returns null for a label that names no figure, or no bytes', async () => {
    expect(await cropFigure(PDF, 'Table 1')).toBeNull();
    expect(await cropFigure(new Uint8Array(0), 'Figure 1')).toBeNull();
  });

  it('leaves the caller’s bytes usable', async () => {
    const bytes = new Uint8Array(PDF);
    await cropFigure(bytes, 'Figure 1');
    expect(bytes.byteLength).toBe(PDF.byteLength);
  });
});
