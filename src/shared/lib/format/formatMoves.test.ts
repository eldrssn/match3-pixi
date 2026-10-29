import { describe, expect, it } from 'vitest';
import { formatMoves, movesWord } from './formatMoves';

describe('formatMoves', () => {
  it('склоняет слово «ход» по числу', () => {
    expect(formatMoves(1)).toBe('1 ход');
    expect(formatMoves(3)).toBe('3 хода');
    expect(formatMoves(5)).toBe('5 ходов');
    expect(formatMoves(11)).toBe('11 ходов');
    expect(movesWord(22)).toBe('хода');
  });
});
