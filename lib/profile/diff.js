import { diffWordsWithSpace } from 'diff';

/**
 * Word-level diff wrapper around the `diff` npm package.
 *
 * @param {string} before
 * @param {string} after
 * @returns {Array<{ type: 'added' | 'removed' | 'unchanged', text: string }>}
 */
export function diffWords(before, after) {
  if (!before && !after) return [];
  const parts = diffWordsWithSpace(before, after);
  return parts.map((part) => ({
    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
    text: part.value,
  }));
}
