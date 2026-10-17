// Line diff for the profile history: what one revision changed. A revision
// stores the text from before its change, so the change is the diff from
// that text to the next newer one. Profiles are a few KB, so a plain LCS
// table is cheap; past MAX_LINES per side diffLines returns null and the
// caller shows the earlier text whole.

const MAX_LINES = 400;

function splitLines(text) {
  const s = String(text ?? '').replace(/\r\n/g, '\n');
  return s === '' ? [] : s.split('\n');
}

/**
 * @param {string} before
 * @param {string} after
 * @returns {Array<{type: 'same'|'added'|'removed', text: string}> | null}
 *   in reading order, a removed line before the line that replaced it; null
 *   when either side is too long to diff.
 */
export function diffLines(before, after) {
  const a = splitLines(before);
  const b = splitLines(after);
  if (a.length > MAX_LINES || b.length > MAX_LINES) return null;
  const n = a.length;
  const m = b.length;
  // lcs[i][j]: longest common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: 'removed', text: a[i++] });
    } else {
      lines.push({ type: 'added', text: b[j++] });
    }
  }
  while (i < n) lines.push({ type: 'removed', text: a[i++] });
  while (j < m) lines.push({ type: 'added', text: b[j++] });
  return lines;
}

/**
 * Keep `context` unchanged lines on each side of every change and fold the
 * rest into `{type: 'gap', count}` entries, so a one-line edit in a long
 * profile reads as one line.
 */
export function withContext(lines, context = 1) {
  const near = new Array(lines.length).fill(false);
  lines.forEach((line, idx) => {
    if (line.type === 'same') return;
    const end = Math.min(lines.length - 1, idx + context);
    for (let k = Math.max(0, idx - context); k <= end; k++) near[k] = true;
  });
  const out = [];
  let skipped = 0;
  lines.forEach((line, idx) => {
    if (!near[idx]) {
      skipped++;
      return;
    }
    if (skipped > 0) out.push({ type: 'gap', count: skipped });
    skipped = 0;
    out.push(line);
  });
  if (skipped > 0) out.push({ type: 'gap', count: skipped });
  return out;
}

/** Added and removed lines in a diffLines result, not counting blank ones. */
export function countChanges(lines) {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (typeof line.text !== 'string' || line.text.trim() === '') continue;
    if (line.type === 'added') added++;
    else if (line.type === 'removed') removed++;
  }
  return { added, removed };
}
