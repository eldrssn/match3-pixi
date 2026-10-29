import { describe, expect, it } from 'vitest';
import {
  applyPartyResult,
  EMPTY_LEVEL_PROGRESS,
  isLevelUnlocked,
  levelProgressStorageKey,
  markMechanicSeen,
  parseLevelProgress,
  readLevelProgress,
  resolveCurrentLevel,
  resolveTutorial,
  writeLevelProgress,
} from './levelProgress';

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
};

describe('levelProgress', () => {
  it('победа открывает следующий уровень и улучшает рекорды, поражение - нет', () => {
    const won = applyPartyResult(
      EMPTY_LEVEL_PROGRESS,
      1,
      { isVictory: true, score: 3000, stars: 2 },
      10
    );

    expect(won).toMatchObject({ unlocked: 2, stars: { 1: 2 }, bestScores: { 1: 3000 } });

    const worse = applyPartyResult(won, 1, { isVictory: true, score: 1000, stars: 3 }, 10);

    // Рекорды независимы: звёзды выросли, очки - нет.
    expect(worse).toMatchObject({ unlocked: 2, stars: { 1: 3 }, bestScores: { 1: 3000 } });
    expect(applyPartyResult(won, 2, { isVictory: false, score: 9000, stars: 0 }, 10)).toBe(won);
  });

  it('уровень без звёзд пишет только рекорд очков и открытый уровень', () => {
    const won = applyPartyResult(
      EMPTY_LEVEL_PROGRESS,
      1,
      { isVictory: true, score: 3000, stars: null },
      10
    );

    expect(won).toMatchObject({ unlocked: 2, stars: {}, bestScores: { 1: 3000 } });
  });

  it('после последнего уровня открытым остаётся последний', () => {
    const progress = applyPartyResult(
      { ...EMPTY_LEVEL_PROGRESS, unlocked: 5 },
      5,
      { isVictory: true, score: 1, stars: 1 },
      5
    );

    expect(progress.unlocked).toBe(5);
    expect(resolveCurrentLevel({ ...progress, unlocked: 99 }, 5)).toBe(5);
    expect(isLevelUnlocked(progress, 5)).toBe(true);
    expect(isLevelUnlocked(progress, 6)).toBe(false);
  });

  it('обучение - только незнакомые механики уровня', () => {
    const level = {
      grid: [
        [
          { id: 'cargo', layers: 2 },
          { id: 'red', overlay: 'ice' },
        ],
      ],
    };
    const seen = markMechanicSeen(EMPTY_LEVEL_PROGRESS, 'cargo');

    expect(resolveTutorial(level, EMPTY_LEVEL_PROGRESS)).toEqual(['cargo', 'ice']);
    expect(resolveTutorial(level, seen)).toEqual(['ice']);
    expect(markMechanicSeen(seen, 'cargo')).toBe(seen);
  });

  it('битая запись хранилища - пустой прогресс, мусор отбрасывается', () => {
    expect(parseLevelProgress('oops')).toEqual(EMPTY_LEVEL_PROGRESS);
    expect(
      parseLevelProgress({
        unlocked: 4,
        stars: { 1: 3, 2: 7, x: 2 },
        bestScores: { 1: 500, 2: -3 },
        seenMechanics: ['ice', 'lava'],
      })
    ).toEqual({ unlocked: 4, stars: { 1: 3 }, bestScores: { 1: 500 }, seenMechanics: ['ice'] });
  });

  it('пишет и читает хранилище; недоступное хранилище не ломает игру', () => {
    const storage = memoryStorage();
    const progress = { ...EMPTY_LEVEL_PROGRESS, unlocked: 3, stars: { 1: 2, 2: 3 } as const };

    writeLevelProgress('main', progress, storage);

    expect(storage.getItem(levelProgressStorageKey('main'))).not.toBeNull();
    expect(readLevelProgress('main', storage)).toEqual(progress);
    expect(readLevelProgress('main', null)).toEqual(EMPTY_LEVEL_PROGRESS);
    expect(() => writeLevelProgress('main', progress, null)).not.toThrow();
  });

  it('у каждого пака свой прогресс, пак главной - на ключе до появления паков', () => {
    const storage = memoryStorage();
    const progress = { ...EMPTY_LEVEL_PROGRESS, unlocked: 5 };

    storage.setItem('match3-pixi:progress:v1', JSON.stringify(progress));

    expect(levelProgressStorageKey('main')).toBe('match3-pixi:progress:v1');
    expect(readLevelProgress('main', storage)).toEqual(progress);
    expect(readLevelProgress('winter', storage)).toEqual(EMPTY_LEVEL_PROGRESS);
    expect(levelProgressStorageKey('winter')).toBe('match3-pixi:progress:winter:v1');
  });
});
