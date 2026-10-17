// Podcast length as three presets rather than a minute count. Gemini
// Notebook's own length option (Shorter / Default / Longer) decides the
// final length more than any target in the focus prompt does, so a minute
// picker promised a precision the audio never had. Each preset names the
// notebook option to pick and the depth that fits its range.

export const PODCAST_LENGTHS = {
  short: {
    label: 'Short',
    range: '5–8 minutes',
    minMinutes: 5,
    maxMinutes: 8,
    notebookOption: 'Shorter',
    themes: '1-2 themes',
    deep: '2-3 top-scored papers (~90 seconds each)',
    brief: '1 notable mention at ~20 seconds, or none',
    drop: 'anything scored below 8/10',
  },
  default: {
    label: 'Default',
    range: '10–15 minutes',
    minMinutes: 10,
    maxMinutes: 15,
    notebookOption: 'Default',
    themes: '2-3 themes',
    deep: '4-6 top-scored papers (~2 minutes each)',
    brief: '2-3 notable mentions at ~30 seconds',
    drop: 'anything scored below 7/10',
  },
  long: {
    label: 'Long',
    range: '20–30 minutes',
    minMinutes: 20,
    maxMinutes: 30,
    notebookOption: 'Longer',
    themes: '3-4 themes',
    deep: '6-9 top-scored papers (~2-3 minutes each)',
    brief: '3-4 notable mentions at ~30 seconds',
    drop: 'anything scored below 5/10',
  },
};

export const PODCAST_LENGTH_IDS = Object.keys(PODCAST_LENGTHS);
export const DEFAULT_PODCAST_LENGTH = 'default';

// ~150 spoken words per minute at conversational pace.
export const WORDS_PER_MINUTE = 150;

/**
 * A preset id from whatever was stored. Saved sessions from before the
 * presets hold a minute count (5, 10, 15, 20 or 30); 20 was the old default
 * and maps to Default.
 */
export function resolvePodcastLength(value) {
  if (typeof value === 'string' && PODCAST_LENGTHS[value]) return value;
  const minutes = Number(value);
  if (Number.isFinite(minutes) && minutes > 0) {
    if (minutes <= 8) return 'short';
    if (minutes <= 20) return 'default';
    return 'long';
  }
  return DEFAULT_PODCAST_LENGTH;
}

export function podcastLengthInfo(value) {
  const id = resolvePodcastLength(value);
  return { id, ...PODCAST_LENGTHS[id] };
}
