import { describe, it, expect } from 'vitest';
import { decodeTexAccents } from '../../../lib/arxiv/texAccents.js';

describe('decodeTexAccents', () => {
  it.each([
    [String.raw`J. M\"uller-Horn`, 'J. Müller-Horn'],
    [String.raw`A. N\'u\~nez`, 'A. Núñez'],
    [String.raw`M. A. Ag\"ueros`, 'M. A. Agüeros'],
    [String.raw`Kutay Nazl{\i}`, 'Kutay Nazlı'],
    [String.raw`Ram\'{\i}rez`, 'Ramírez'],
    [String.raw`G\"{o}del`, 'Gödel'],
    [String.raw`{\"o}zel`, 'özel'],
    [String.raw`\c{C}elik`, 'Çelik'],
    [String.raw`\v{S}imon`, 'Šimon'],
    [String.raw`\c c`, 'ç'],
    [String.raw`\AA{}ngstr\"om`, 'Ångström'],
    [String.raw`Bj\o rn`, 'Bjørn'],
    [String.raw`Pa\l{}ka`, 'Pałka'],
    [String.raw`Stra\ss e`, 'Straße'],
  ])('decodes %s', (input, expected) => {
    expect(decodeTexAccents(input)).toBe(expected);
  });

  it('leaves math and other commands alone', () => {
    expect(decodeTexAccents(String.raw`$\texttt{NFDiag}$: High-dimensional`)).toBe(
      String.raw`$\texttt{NFDiag}$: High-dimensional`
    );
    expect(decodeTexAccents(String.raw`Schr\"odinger $e^{i\pi}$ and $x^{2}$`)).toBe(
      String.raw`Schrödinger $e^{i\pi}$ and $x^{2}$`
    );
  });

  it('returns plain text unchanged and tolerates empty input', () => {
    expect(decodeTexAccents('Plain Title')).toBe('Plain Title');
    expect(decodeTexAccents('')).toBe('');
    expect(decodeTexAccents(undefined)).toBe('');
  });
});
