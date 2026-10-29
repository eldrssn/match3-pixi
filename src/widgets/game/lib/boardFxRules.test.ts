import { describe, expect, it } from 'vitest';
import { cellCenter } from './boardGeometry';
import {
  clampComboLabel,
  listCrossBeams,
  resolveFlashAlpha,
  resolveFlightPoint,
  resolveRingScale,
  resolveShakeOffset,
} from './boardFxRules';

describe('boardFxRules', () => {
  it('тряска - в пределах ±intensity размера экрана по каждой оси', () => {
    const size = { width: 400, height: 800 };

    expect(resolveShakeOffset(0.005, size, () => 1)).toEqual({ x: 2, y: 4 });
    expect(resolveShakeOffset(0.005, size, () => 0)).toEqual({ x: -2, y: -4 });
    expect(resolveShakeOffset(0.005, size, () => 0.5)).toEqual({ x: 0, y: 0 });
  });

  it('вспышка гаснет линейно и не уходит в минус', () => {
    expect(resolveFlashAlpha(0, 140)).toBe(1);
    expect(resolveFlashAlpha(70, 140)).toBeCloseTo(0.5);
    expect(resolveFlashAlpha(200, 140)).toBe(0);
  });

  it('крест ракета+ракета - строка и колонка клетки', () => {
    const beams = listCrossBeams({ col: 2, row: 3 }, 1, { colCount: 6, rowCount: 6 });

    expect(beams).toEqual([
      { point: cellCenter({ col: 2, row: 3 }), angleDeg: 0 },
      { point: cellCenter({ col: 2, row: 3 }), angleDeg: 90 },
    ]);
  });

  it('залп шириной 3 у края поля не рисует линии за краем', () => {
    const beams = listCrossBeams({ col: 0, row: 0 }, 3, { colCount: 6, rowCount: 6 });

    expect(beams).toHaveLength(4);
    expect(beams.filter((beam) => beam.angleDeg === 0)).toHaveLength(2);
  });

  it('кольцо выходит за край зоны на 15%', () => {
    expect(resolveRingScale(100, 230)).toBeCloseTo(0.5);
  });

  it('дуга пропеллера: концы на месте, середина выше прямой на долю пути', () => {
    const start = { x: 0, y: 100 };
    const end = { x: 100, y: 100 };

    expect(resolveFlightPoint(start, end, 0)).toEqual(start);
    expect(resolveFlightPoint(start, end, 1).x).toBe(100);
    expect(resolveFlightPoint(start, end, 1).y).toBeCloseTo(100);
    expect(resolveFlightPoint(start, end, 0.5)).toEqual({ x: 50, y: 65 });
  });

  it('множитель каскада - одна цифра', () => {
    expect(clampComboLabel(3)).toBe(3);
    expect(clampComboLabel(14)).toBe(9);
  });
});
