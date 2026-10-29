import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVEL_BOOSTERS } from '@/entities/level';
import {
  MAX_CONTINUES_PER_PARTY,
  NEAR_MISS_EXTRA_MOVES,
  resolveContinueOffer,
  resolveNextLevelNumber,
  resolvePartyBoosters,
  resolvePreBoosterOptions,
  resolveStartLevelNumber,
} from './partyRules';

describe('resolveStartLevelNumber', () => {
  it('берёт уровень из ?level в границах каталога', () => {
    expect(resolveStartLevelNumber(2, 1, 3)).toBe(2);
    expect(resolveStartLevelNumber(3, 1, 3)).toBe(3);
  });

  it('игнорирует ?level за пределами каталога', () => {
    expect(resolveStartLevelNumber(4, 2, 3)).toBe(2);
  });

  it('без флага начинает с текущего уровня хоста', () => {
    expect(resolveStartLevelNumber(null, 2, 3)).toBe(2);
  });
});

describe('resolveNextLevelNumber', () => {
  it('ведёт на следующий уровень', () => {
    expect(resolveNextLevelNumber(1, 3)).toBe(2);
  });

  it('после последнего уровня повторяет последний', () => {
    expect(resolveNextLevelNumber(3, 3)).toBe(3);
  });
});

describe('resolvePartyBoosters', () => {
  it('первый уровень идёт без бустеров', () => {
    expect(resolvePartyBoosters(1)).toEqual([]);
  });

  it('со второго уровня - фиксированный набор', () => {
    expect(resolvePartyBoosters(2)).toBe(DEFAULT_LEVEL_BOOSTERS);
  });
});

describe('resolveContinueOffer', () => {
  it('предлагает добавочные ходы один раз за партию', () => {
    expect(resolveContinueOffer(0)).toBe(NEAR_MISS_EXTRA_MOVES);
    expect(resolveContinueOffer(MAX_CONTINUES_PER_PARTY)).toBeNull();
  });
});

describe('resolvePreBoosterOptions', () => {
  it('первый уровень - без предуровневых бустеров, дальше - все три', () => {
    expect(resolvePreBoosterOptions(1)).toEqual([]);
    expect(resolvePreBoosterOptions(2)).toEqual(['laser', 'bomb', 'rainbow']);
  });
});
