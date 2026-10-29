import { describe, expect, it } from 'vitest';
import { INITIAL_MINIGAME_LEVEL_CONFIG } from '@/entities/game';
import { DEFAULT_LEVEL_PACK } from '../model/levelCatalog';
import {
  isLevelPackId,
  parseLevelPackFile,
  renumberPackLevels,
  toLevelPackFile,
} from './levelPackFile';

const level = (id: number) => ({ ...INITIAL_MINIGAME_LEVEL_CONFIG, id });

describe('levelPackFile', () => {
  it('round-trips the main pack through its single-file form', () => {
    const file = JSON.parse(JSON.stringify(toLevelPackFile(DEFAULT_LEVEL_PACK)));
    const { pack, errors } = parseLevelPackFile(file);

    expect(errors).toEqual([]);
    expect(pack).toEqual({ ...DEFAULT_LEVEL_PACK, levels: [...DEFAULT_LEVEL_PACK.levels] });
  });

  it('is not a pack without a levels list', () => {
    expect(parseLevelPackFile({ id: 'x' })).toEqual({
      pack: null,
      errors: ['Это не файл пака: нет списка уровней `levels`.'],
    });
    expect(parseLevelPackFile(null).pack).toBeNull();
  });

  it('reports the id, title, version and each level by its position', () => {
    const { errors } = parseLevelPackFile({
      packFormatVersion: 99,
      id: 'Main Pack',
      title: ' ',
      levels: [level(1), { ...level(3), moves: 0 }],
    });

    expect(errors).toEqual([
      'Версия файла пака 99 не поддерживается (ожидается 1).',
      'Id пака «Main Pack»: строчная латиница, цифры, «-» и «_», до 32 символов, с буквы или цифры.',
      'У пака нет названия.',
      'Уровень 2: id 3, а должен совпадать с позицией в паке.',
    ]);
  });

  it('reports levels the normalization would silently fill from the template', () => {
    const { grid: _grid, ...noGrid } = level(2);
    const { errors } = parseLevelPackFile({
      packFormatVersion: 1,
      id: 'main',
      title: 'Main',
      levels: [
        'level',
        noGrid,
        { ...level(3), grid: [] },
        { ...level(4), levelGoals: 'all' },
        [level(5)],
      ],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        'Уровень 1: это не объект уровня.',
        'Уровень 2: нет поля `grid` или оно пустое.',
        'Уровень 3: нет поля `grid` или оно пустое.',
        'Уровень 4: нет списка целей `levelGoals`.',
        'Уровень 5: это не объект уровня.',
      ])
    );
    expect(errors).not.toContain('Уровень 4: нет поля `grid` или оно пустое.');
  });

  it('renumbers levels by position, keeping untouched ones by reference', () => {
    const first = level(1);
    const renumbered = renumberPackLevels([first, level(5), level(2)]);

    expect(renumbered.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(renumbered[0]).toBe(first);
  });

  it('accepts folder-safe pack ids only', () => {
    expect(isLevelPackId('main')).toBe(true);
    expect(isLevelPackId('winter-2026_b')).toBe(true);
    expect(isLevelPackId('')).toBe(false);
    expect(isLevelPackId('-main')).toBe(false);
    expect(isLevelPackId('../main')).toBe(false);
  });
});
