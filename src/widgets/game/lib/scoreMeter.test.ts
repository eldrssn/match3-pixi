import { describe, expect, it } from 'vitest';
import { formatScoreMeterText, resolveScoreMeterFill, resolveScoreMeterMarks } from './scoreMeter';

describe('scoreMeter', () => {
  it('первая звезда в начале, третья - не в самом конце полосы', () => {
    const [first, second, third] = resolveScoreMeterMarks([1000, 2000]);

    expect(first).toBe(0);
    expect(second).toBeCloseTo(third / 2);
    expect(third).toBeLessThan(1);
  });

  it('заполнение растёт со счётом и не выходит за полосу', () => {
    expect(resolveScoreMeterFill(0, [1000, 2000])).toBe(0);
    expect(resolveScoreMeterFill(2000, [1000, 2000])).toBeCloseTo(
      resolveScoreMeterMarks([1000, 2000])[2]
    );
    expect(resolveScoreMeterFill(1_000_000, [1000, 2000])).toBe(1);
  });

  it('без порогов звёзд счёт подписан, рядом с полосой - голое число', () => {
    expect(formatScoreMeterText(1250, undefined)).toBe('Очки: 1\u2009250');
    expect(formatScoreMeterText(0, undefined)).toBe('Очки: 0');
    expect(formatScoreMeterText(1250, [1000, 2000])).toBe('1\u2009250');
  });
});
