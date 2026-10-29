import { describe, expect, it } from 'vitest';
import { resolveTapAction, type ITappedCell } from './tapSelection';

const chip = (col: number, row: number): ITappedCell => ({
  col,
  row,
  isSpecial: false,
  canSwap: true,
});
const special = (col: number, row: number): ITappedCell => ({
  col,
  row,
  isSpecial: true,
  canSwap: true,
});
const blocker = (col: number, row: number): ITappedCell => ({
  col,
  row,
  isSpecial: false,
  canSwap: false,
});

describe('resolveTapAction', () => {
  it('первый тап выбирает фишку, тап по соседу - ход', () => {
    expect(resolveTapAction(null, chip(2, 2))).toBe('select');
    expect(resolveTapAction({ col: 2, row: 2 }, chip(3, 2))).toBe('swap');
    expect(resolveTapAction({ col: 2, row: 2 }, special(2, 3))).toBe('swap');
  });

  it('повторный тап снимает выбор, дальний тап перевыбирает', () => {
    expect(resolveTapAction({ col: 2, row: 2 }, chip(2, 2))).toBe('clear');
    expect(resolveTapAction({ col: 2, row: 2 }, chip(4, 4))).toBe('select');
    // Диагональ - не сосед.
    expect(resolveTapAction({ col: 2, row: 2 }, chip(3, 3))).toBe('select');
  });

  it('спецфишка без выбора (или не по соседству) взрывается тапом', () => {
    expect(resolveTapAction(null, special(1, 1))).toBe('activate');
    expect(resolveTapAction({ col: 4, row: 4 }, special(1, 1))).toBe('activate');
  });

  it('блокер выбора не берёт', () => {
    expect(resolveTapAction(null, blocker(0, 0))).toBe('none');
    expect(resolveTapAction({ col: 0, row: 1 }, blocker(0, 0))).toBe('clear');
  });
});
