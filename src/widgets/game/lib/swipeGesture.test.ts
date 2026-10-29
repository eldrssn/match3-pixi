import { describe, expect, it } from 'vitest';
import { resolveSwipeDirection } from './swipeGesture';

describe('resolveSwipeDirection', () => {
  it('четыре оси экрана: X вправо, Y вниз', () => {
    expect(resolveSwipeDirection(10, 0)).toEqual({ dirX: 1, dirY: 0 });
    expect(resolveSwipeDirection(-10, 0)).toEqual({ dirX: -1, dirY: 0 });
    expect(resolveSwipeDirection(0, 10)).toEqual({ dirX: 0, dirY: 1 });
    expect(resolveSwipeDirection(0, -10)).toEqual({ dirX: 0, dirY: -1 });
  });

  it('диагональ выбирает доминирующую ось', () => {
    expect(resolveSwipeDirection(10, 4)).toEqual({ dirX: 1, dirY: 0 });
    expect(resolveSwipeDirection(3, -9)).toEqual({ dirX: 0, dirY: -1 });
  });

  it('ровно 45° - горизонталь, как у эталона', () => {
    expect(resolveSwipeDirection(5, 5)).toEqual({ dirX: 1, dirY: 0 });
    expect(resolveSwipeDirection(-5, 5)).toEqual({ dirX: -1, dirY: 0 });
  });

  it('нулевая дельта - вправо: тап отсекает порог, а не ось', () => {
    expect(resolveSwipeDirection(0, 0)).toEqual({ dirX: 1, dirY: 0 });
  });
});
