import { describe, expect, it } from 'vitest';
import { BOARD_FIT_AREA, resolveBoardDesignSize, resolveBoardFitScale } from './boardFit';

describe('resolveBoardDesignSize', () => {
  it('клетки плюс зазоры между ними, без зазора по краям', () => {
    expect(resolveBoardDesignSize(6, 6)).toEqual({ width: 352, height: 352 });
    expect(resolveBoardDesignSize(1, 2)).toEqual({ width: 57, height: 116 });
  });
});

describe('resolveBoardFitScale', () => {
  it('поле 6×6 и меньше идёт в макетном размере', () => {
    expect(resolveBoardFitScale(6, 6)).toBe(1);
    expect(resolveBoardFitScale(4, 5)).toBe(1);
  });

  it('большое поле ужимается целиком в область 6×6', () => {
    const scale = resolveBoardFitScale(9, 9);
    const size = resolveBoardDesignSize(9, 9);

    expect(size.width * scale).toBeCloseTo(BOARD_FIT_AREA.width);
    expect(size.height * scale).toBeCloseTo(BOARD_FIT_AREA.height);
  });

  it('вытянутое поле ужимается по длинной оси, клетка остаётся квадратной', () => {
    const scale = resolveBoardFitScale(6, 8);
    const size = resolveBoardDesignSize(6, 8);

    expect(size.height * scale).toBeCloseTo(BOARD_FIT_AREA.height);
    expect(size.width * scale).toBeLessThan(BOARD_FIT_AREA.width);
  });

  it('пустое поле не делит на ноль', () => {
    expect(resolveBoardFitScale(0, 0)).toBe(1);
  });
});
