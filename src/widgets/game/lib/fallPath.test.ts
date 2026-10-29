import { describe, expect, it } from 'vitest';
import { resolveFallSegments } from './fallPath';

describe('resolveFallSegments', () => {
  it('шаги прямо вниз сливаются в один отрезок', () => {
    expect(
      resolveFallSegments({ col: 2, row: 0 }, [
        { col: 2, row: 1 },
        { col: 2, row: 2 },
        { col: 2, row: 4 },
      ])
    ).toEqual([{ to: { col: 2, row: 4 }, rows: 4, dCol: 0 }]);
  });

  it('диагональ - свой отрезок, дальше падение в новой колонке', () => {
    expect(
      resolveFallSegments({ col: 1, row: 0 }, [
        { col: 1, row: 1 },
        { col: 0, row: 2 },
        { col: 0, row: 3 },
        { col: 0, row: 4 },
      ])
    ).toEqual([
      { to: { col: 1, row: 1 }, rows: 1, dCol: 0 },
      { to: { col: 0, row: 2 }, rows: 1, dCol: -1 },
      { to: { col: 0, row: 4 }, rows: 2, dCol: 0 },
    ]);
  });

  it('новая фишка въезжает из-за верхней границы', () => {
    expect(
      resolveFallSegments({ col: 3, row: -1 }, [
        { col: 3, row: 0 },
        { col: 3, row: 2 },
      ])
    ).toEqual([{ to: { col: 3, row: 2 }, rows: 3, dCol: 0 }]);
  });
});
