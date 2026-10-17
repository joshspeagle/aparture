// Decode the TeX accent macros arXiv metadata carries in author names and
// titles ("M\"uller", "N\'u\~nez", "Nazl{\i}", "\c{C}elik") into Unicode.
// Math ($...$) is left alone: only accent macros and the special-letter
// commands are rewritten, and braces are dropped only around a single
// letter, which TeX renders identically.

const SPECIAL_LETTERS = {
  ss: 'ß',
  aa: 'å',
  AA: 'Å',
  ae: 'æ',
  AE: 'Æ',
  oe: 'œ',
  OE: 'Œ',
  o: 'ø',
  O: 'Ø',
  l: 'ł',
  L: 'Ł',
  i: 'ı',
  j: 'ȷ',
};

const COMBINING = {
  '"': '̈',
  "'": '́',
  '`': '̀',
  '^': '̂',
  '~': '̃',
  '=': '̄',
  '.': '̇',
  u: '̆',
  v: '̌',
  H: '̋',
  c: '̧',
  k: '̨',
  r: '̊',
};

// The accent's base letter: a plain letter, or \i / \j (an accent on a
// dotless i is just an accented i in Unicode).
const BASE = String.raw`(\\[ij](?![a-zA-Z])|[a-zA-Z])`;
const SYMBOL_ACCENT = new RegExp(String.raw`\\(["'\x60^~=.])\s*(?:\{\s*${BASE}\s*\}|${BASE})`, 'g');
const LETTER_ACCENT = new RegExp(String.raw`\\([uvHckr])(?:\{\s*${BASE}\s*\}|\s+${BASE})`, 'g');
// A control word swallows one following space or an empty group, as in
// TeX: "Bj\o rn" is Bjørn and "\AA{}ngstr" is Ångstr.
const SPECIAL = /\\(ss|aa|AA|ae|AE|oe|OE|o|O|l|L|i|j)(?![a-zA-Z])(?:\{\}|\s)?/g;

const baseLetter = (b) => (b === '\\i' ? 'i' : b === '\\j' ? 'j' : b);

/**
 * @param {string} text
 * @returns {string}
 */
export function decodeTexAccents(text) {
  if (!text || !text.includes('\\')) return text ?? '';
  return text
    .replace(
      SYMBOL_ACCENT,
      (_, accent, braced, bare) => baseLetter(braced ?? bare) + COMBINING[accent]
    )
    .replace(
      LETTER_ACCENT,
      (_, accent, braced, bare) => baseLetter(braced ?? bare) + COMBINING[accent]
    )
    .replace(SPECIAL, (_, name) => SPECIAL_LETTERS[name])
    .replace(/\{(\p{L}\p{M}*)\}/gu, '$1')
    .normalize('NFC');
}
