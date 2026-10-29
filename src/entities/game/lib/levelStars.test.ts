import { describe, expect, it } from 'vitest';
import { resolveLevelStars, suggestStarScores } from './levelStars';

describe('levelStars', () => {
  it('первая звезда - за победу, вторая и третья - за очки', () => {
    expect(resolveLevelStars(false, 99_999, [1000, 2000])).toBe(0);
    expect(resolveLevelStars(true, 0, [1000, 2000])).toBe(1);
    expect(resolveLevelStars(true, 1000, [1000, 2000])).toBe(2);
    expect(resolveLevelStars(true, 2500, [1000, 2000])).toBe(3);
  });

  it('уровень без порогов звёзд не ведёт ни на победе, ни на поражении', () => {
    expect(resolveLevelStars(true, 99_999, undefined)).toBeNull();
    expect(resolveLevelStars(false, 0, undefined)).toBeNull();
  });

  it('пороги по очкам бота: средний - вторая звезда, лучшая пятая часть - третья', () => {
    expect(suggestStarScores([])).toBeNull();
    expect(
      suggestStarScores([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10_000])
    ).toEqual([5000, 9000]);
    // Третья звезда всегда дороже второй, даже на одной партии.
    expect(suggestStarScores([4321])).toEqual([4300, 4400]);
  });
});
