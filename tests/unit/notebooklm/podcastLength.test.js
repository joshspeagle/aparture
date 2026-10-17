import { describe, it, expect } from 'vitest';
import {
  PODCAST_LENGTH_IDS,
  podcastLengthInfo,
  resolvePodcastLength,
} from '../../../lib/notebooklm/podcastLength.js';
import { instructionsMd } from '../../../lib/notebooklm/instructions.js';

describe('podcast length presets', () => {
  it('keeps preset ids and maps legacy minute counts', () => {
    expect(PODCAST_LENGTH_IDS).toEqual(['short', 'default', 'long']);
    for (const id of PODCAST_LENGTH_IDS) expect(resolvePodcastLength(id)).toBe(id);
    expect([5, 10, 15, 20, 30].map(resolvePodcastLength)).toEqual([
      'short',
      'default',
      'default',
      'default',
      'long',
    ]);
    expect(resolvePodcastLength('20')).toBe('default');
  });

  it('falls back to Default for anything unrecognised', () => {
    for (const v of [undefined, null, '', 'huge', 0, -3, {}]) {
      expect(resolvePodcastLength(v)).toBe('default');
    }
  });

  it('pairs each preset with the notebook option of the same length', () => {
    expect(PODCAST_LENGTH_IDS.map((id) => podcastLengthInfo(id).notebookOption)).toEqual([
      'Shorter',
      'Default',
      'Longer',
    ]);
  });

  it('writes the chosen preset into the bundle instructions', () => {
    const md = instructionsMd(podcastLengthInfo('long'));
    expect(md).toContain('**Long** episode (about 20–30 minutes)');
    expect(md).toContain('choose **Longer**');
    expect(md).toContain('Gemini Notebook');
  });
});
