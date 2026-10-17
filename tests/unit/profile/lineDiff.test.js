import { describe, expect, it } from 'vitest';
import { countChanges, diffLines, withContext } from '../../../lib/profile/lineDiff.js';

describe('diffLines', () => {
  it('marks a replaced line as removed, then added', () => {
    expect(diffLines('a\nb\nc', 'a\nB\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'B' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('handles pure insertions and deletions', () => {
    expect(diffLines('a\nc', 'a\nb\nc').map((l) => l.type)).toEqual(['same', 'added', 'same']);
    expect(diffLines('a\nb\nc', 'a\nc').map((l) => l.type)).toEqual(['same', 'removed', 'same']);
  });

  it('treats empty text as no lines and ignores CRLF differences', () => {
    expect(diffLines('', 'x')).toEqual([{ type: 'added', text: 'x' }]);
    expect(diffLines('x', '')).toEqual([{ type: 'removed', text: 'x' }]);
    expect(diffLines('a\r\nb', 'a\nb').every((l) => l.type === 'same')).toBe(true);
  });

  it('gives up on texts too long to diff', () => {
    const long = Array.from({ length: 401 }, (_, i) => `line ${i}`).join('\n');
    expect(diffLines(long, 'short')).toBeNull();
  });
});

describe('withContext', () => {
  it('folds unchanged runs beyond the context window', () => {
    const before = ['1', '2', '3', '4', '5', '6', '7'].join('\n');
    const after = ['1', '2', '3', 'four', '5', '6', '7'].join('\n');
    expect(withContext(diffLines(before, after), 1)).toEqual([
      { type: 'gap', count: 2 },
      { type: 'same', text: '3' },
      { type: 'removed', text: '4' },
      { type: 'added', text: 'four' },
      { type: 'same', text: '5' },
      { type: 'gap', count: 2 },
    ]);
  });
});

describe('countChanges', () => {
  it('counts added and removed lines, skipping blank ones', () => {
    const lines = diffLines('keep\nold', 'keep\nnew\n\nalso new');
    expect(countChanges(lines)).toEqual({ added: 2, removed: 1 });
  });
});
