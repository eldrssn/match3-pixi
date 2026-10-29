import { describe, expect, it } from 'vitest';
import {
  LOW_MOVES_THRESHOLD,
  pickBreathDelayMs,
  resolveBoosterButtonState,
  resolveGoalSlotsX,
  resolveLitStars,
  resolveMovesColor,
  resolveStarPoints,
} from './hudRules';

describe('resolveMovesColor', () => {
  it('тревожится с порога и ниже, выше - обычный цвет', () => {
    expect(resolveMovesColor(LOW_MOVES_THRESHOLD + 1, 'normal', 'low')).toBe('normal');
    expect(resolveMovesColor(LOW_MOVES_THRESHOLD, 'normal', 'low')).toBe('low');
    expect(resolveMovesColor(0, 'normal', 'low')).toBe('low');
  });
});

describe('resolveGoalSlotsX', () => {
  it('ставит иконки рядом по центру панели', () => {
    expect(resolveGoalSlotsX(1, 59)).toEqual([0]);
    expect(resolveGoalSlotsX(2, 59)).toEqual([-29.5, 29.5]);
    expect(resolveGoalSlotsX(3, 59)).toEqual([-59, 0, 59]);
  });

  it('без целей - пустой ряд', () => {
    expect(resolveGoalSlotsX(0, 59)).toEqual([]);
  });
});

describe('resolveBoosterButtonState', () => {
  it('кнопка с зарядами видна и кликается', () => {
    expect(resolveBoosterButtonState(2, false)).toEqual({
      isVisible: true,
      isInteractive: true,
      isDimmed: false,
    });
  });

  it('пустая притушена и не кликается', () => {
    expect(resolveBoosterButtonState(0, false)).toEqual({
      isVisible: true,
      isInteractive: false,
      isDimmed: true,
    });
  });

  it('партия без бустеров прячет кнопку и не даёт её нажать', () => {
    expect(resolveBoosterButtonState(3, true)).toMatchObject({
      isVisible: false,
      isInteractive: false,
    });
  });
});

describe('resolveLitStars', () => {
  const thresholds = [100, 200] as const;

  it('первая звезда - только за победу', () => {
    expect(resolveLitStars({ isGameEnded: false, isGameWin: false, score: 0 }, thresholds)).toEqual(
      [false, false, false]
    );
    expect(resolveLitStars({ isGameEnded: true, isGameWin: false, score: 0 }, thresholds)).toEqual([
      false,
      false,
      false,
    ]);
    expect(resolveLitStars({ isGameEnded: true, isGameWin: true, score: 0 }, thresholds)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('вторая и третья - по порогам очков и до победы', () => {
    expect(
      resolveLitStars({ isGameEnded: false, isGameWin: false, score: 150 }, thresholds)
    ).toEqual([false, true, false]);
    expect(
      resolveLitStars({ isGameEnded: false, isGameWin: false, score: 200 }, thresholds)
    ).toEqual([false, true, true]);
  });
});

describe('pickBreathDelayMs', () => {
  it('целое в границах включительно', () => {
    expect(pickBreathDelayMs(4000, 6000, () => 0)).toBe(4000);
    expect(pickBreathDelayMs(4000, 6000, () => 0.999999)).toBe(6000);
    expect(pickBreathDelayMs(4000, 6000, () => 0.5)).toBe(5000);
  });
});

describe('resolveStarPoints', () => {
  it('десять вершин, первая - вверх на внешнем радиусе', () => {
    const points = resolveStarPoints(9, 4);

    expect(points).toHaveLength(20);
    expect(points[0]).toBeCloseTo(0);
    expect(points[1]).toBeCloseTo(-9);
    expect(Math.hypot(points[2] ?? 0, points[3] ?? 0)).toBeCloseTo(4);
  });
});
