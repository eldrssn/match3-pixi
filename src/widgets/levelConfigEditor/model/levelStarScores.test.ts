import { describe, expect, it } from 'vitest';
import { INITIAL_MINIGAME_LEVEL_CONFIG } from '@/entities/game';
import { disableStarScores, enableStarScores, updateStarScore } from './levelStarScores';

describe('levelStarScores', () => {
  const level = { ...INITIAL_MINIGAME_LEVEL_CONFIG, moves: 10 };

  it('включение ставит стартовые пороги от ходов или переданные', () => {
    expect(enableStarScores(level).starScores).toEqual([4000, 7000]);
    expect(enableStarScores(level, [100, 200]).starScores).toEqual([100, 200]);
  });

  it('выключение убирает поле целиком', () => {
    const off = disableStarScores(enableStarScores(level));

    expect('starScores' in off).toBe(false);
  });

  it('правит один порог, не трогая другой', () => {
    expect(updateStarScore(enableStarScores(level), 1, 9000).starScores).toEqual([4000, 9000]);
  });
});
