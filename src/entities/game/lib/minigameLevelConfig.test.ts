import { describe, expect, it } from 'vitest';
import type { IMinigameLevelCell } from '../types';
import {
  createEmptyMinigameGrid,
  getMinigamePaletteLayer,
  INITIAL_MINIGAME_LEVEL_CONFIG,
  isMinigameElementId,
  DEFAULT_LEVEL_COLORS,
  LEVEL_TITLE_MAX_LENGTH,
  normalizeLevelColors,
  normalizeMinigameLevelConfig,
  resizeMinigameGrid,
  validateMinigameLevelConfig,
} from './minigameLevelConfig';

describe('getMinigamePaletteLayer', () => {
  it('puts overlays on top, the floor underneath and everything else as the cell piece', () => {
    expect(getMinigamePaletteLayer('ice')).toBe('overlay');
    expect(getMinigamePaletteLayer('chain')).toBe('overlay');
    expect(getMinigamePaletteLayer('floor')).toBe('floor');
    expect(getMinigamePaletteLayer('cargo')).toBe('piece');
    expect(getMinigamePaletteLayer('HOLE')).toBe('piece');
  });
});

describe('isMinigameElementId', () => {
  it('knows palette codes and special chips, not editor tools or junk', () => {
    expect(isMinigameElementId('red')).toBe(true);
    expect(isMinigameElementId('floor')).toBe(true);
    expect(isMinigameElementId('laser')).toBe(true);
    expect(isMinigameElementId('laserVertical')).toBe(false);
    expect(isMinigameElementId('')).toBe(false);
  });
});

describe('minigameLevelConfig', () => {
  it('keeps the initial editor preset JSON-round-trippable and valid', () => {
    const parsed = JSON.parse(JSON.stringify(INITIAL_MINIGAME_LEVEL_CONFIG));

    expect(parsed).toEqual(INITIAL_MINIGAME_LEVEL_CONFIG);
    expect(validateMinigameLevelConfig(parsed)).toEqual([]);
  });

  it('normalizes partial config through stable defaults', () => {
    const config = normalizeMinigameLevelConfig({ id: 2, moves: 20 });

    expect(config.id).toBe(2);
    expect(config.moves).toBe(20);
    expect(config.levelGoals).toEqual(INITIAL_MINIGAME_LEVEL_CONFIG.levelGoals);
    expect(config.grid).toEqual(INITIAL_MINIGAME_LEVEL_CONFIG.grid);
  });

  it('keeps the title as typed and drops the retired rhythm role of old JSON', () => {
    const config = normalizeMinigameLevelConfig({
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      title: 'Тонкий ',
      ...{ rhythm: 'spike' },
    });

    expect(config.title).toBe('Тонкий ');
    expect(config).not.toHaveProperty('rhythm');
    expect(validateMinigameLevelConfig(config)).toEqual([]);
    expect(normalizeMinigameLevelConfig({ ...config, title: '   ' })).not.toHaveProperty('title');
  });

  it('reports an overlong title instead of hiding it', () => {
    const config = normalizeMinigameLevelConfig({
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      title: 'Я'.repeat(LEVEL_TITLE_MAX_LENGTH + 1),
    });

    expect(validateMinigameLevelConfig(config)).toEqual([
      `Название уровня - не длиннее ${LEVEL_TITLE_MAX_LENGTH} символов.`,
    ]);
  });

  it('blocks empty draft cells before preview apply', () => {
    const config = {
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      grid: createEmptyMinigameGrid(6, 6),
    };

    expect(validateMinigameLevelConfig(config)).toContain(
      'Клетка (кол. 1, стр. 1) должна содержать допустимый элемент.'
    );
  });

  it('puts overlays only on top of a chip', () => {
    const config = {
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      grid: [[{ id: 'cargo', layers: 2, overlay: 'ice' }]],
    };

    expect(validateMinigameLevelConfig(config)).toContain(
      'Накладка в клетке (кол. 1, стр. 1) должна лежать поверх фишки.'
    );
    expect(
      validateMinigameLevelConfig({
        ...INITIAL_MINIGAME_LEVEL_CONFIG,
        grid: [[{ id: 'random', overlay: 'ice' }]],
      }).filter((error) => error.includes('Накладка'))
    ).toEqual([]);
  });

  it('migrates a v1 ice cell into a chip with an ice overlay', () => {
    const config = normalizeMinigameLevelConfig({
      id: 3,
      moves: 10,
      grid: [[{ id: 'ice', innerId: 'red' }, { id: 'cargo' }]],
    });

    expect(config.formatVersion).toBe(2);
    expect(config.grid[0]).toEqual([
      { id: 'red', overlay: 'ice' },
      { id: 'cargo', layers: 2 },
    ]);
  });

  it('checks layer limits and where layers may lie', () => {
    const grid: IMinigameLevelCell[][] = createEmptyMinigameGrid(3, 3).map((column) =>
      column.map(() => ({ id: 'red' }))
    );
    grid[0][0] = { id: 'cargo', layers: 4 };
    grid[1][0] = { id: 'HOLE', floor: 1 };
    grid[2][0] = { id: 'red', layers: 2 };
    grid[2][2] = { id: 'drop' };

    const errors = validateMinigameLevelConfig({ ...INITIAL_MINIGAME_LEVEL_CONFIG, grid });

    expect(errors).toContain('Ящик в клетке (кол. 1, стр. 1) - от 1 до 3 слоёв.');
    expect(errors).toContain('Под дырой не бывает подложки: клетка (кол. 2, стр. 1).');
    expect(errors).toContain('Слои бывают только у ящика: клетка (кол. 3, стр. 1).');
    expect(errors).toContain('«Опусти вниз» в клетке (кол. 3, стр. 3) уже стоит внизу колонки.');
  });

  it('accepts specials placed on the field, an axis only on a rocket', () => {
    const grid: IMinigameLevelCell[][] = createEmptyMinigameGrid(3, 3).map((column) =>
      column.map(() => ({ id: 'red' }))
    );
    grid[0][0] = { id: 'laser', direction: 'vertical' };
    grid[1][0] = { id: 'bomb' };
    grid[2][0] = { id: 'rainbow', direction: 'horizontal' };
    grid[0][1] = { id: 'laser', direction: 'diagonal' as 'vertical' };
    grid[1][1] = { id: 'propeller', overlay: 'ice' };

    const errors = validateMinigameLevelConfig({ ...INITIAL_MINIGAME_LEVEL_CONFIG, grid });

    expect(errors.filter((error) => error.includes('(кол. 1, стр. 1)'))).toEqual([]);
    expect(errors.filter((error) => error.includes('(кол. 2, стр. 1)'))).toEqual([]);
    expect(errors).toContain('Ось бывает только у ракеты: клетка (кол. 3, стр. 1).');
    expect(errors).toContain('Ось ракеты в клетке (кол. 1, стр. 2) - horizontal или vertical.');
    expect(errors).toContain('Накладка в клетке (кол. 2, стр. 2) должна лежать поверх фишки.');
  });

  it('keeps the rocket axis through normalization', () => {
    const config = normalizeMinigameLevelConfig({
      id: 1,
      moves: 10,
      grid: [[{ id: 'laser', direction: 'vertical' }, { id: 'bomb' }]],
    });

    expect(config.grid[0]).toEqual([{ id: 'laser', direction: 'vertical' }, { id: 'bomb' }]);
  });

  it('a non-chip goal cannot ask for more than the field holds', () => {
    const grid: IMinigameLevelCell[][] = createEmptyMinigameGrid(3, 3).map((column) =>
      column.map(() => ({ id: 'red' }))
    );
    grid[1][1] = { id: 'red', floor: 1 };

    const errors = validateMinigameLevelConfig({
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      levelGoals: [{ id: 'floor', count: 2 }],
      grid,
    });

    expect(errors).toContain('Цель #1: на поле 1 шт. «floor», а нужно 2.');

    const labels: Record<string, string> = { floor: 'Подложка' };
    const labelled = validateMinigameLevelConfig(
      { ...INITIAL_MINIGAME_LEVEL_CONFIG, levelGoals: [{ id: 'floor', count: 2 }], grid },
      { describeElement: (id) => labels[id] ?? null }
    );

    expect(labelled).toContain('Цель #1: на поле 1 шт. «Подложка», а нужно 2.');
  });

  it('names a goal by code when the caller has no label for it', () => {
    const errors = validateMinigameLevelConfig(
      {
        ...INITIAL_MINIGAME_LEVEL_CONFIG,
        colors: ['red', 'blue'],
        levelGoals: [{ id: 'green', count: 1 }],
      },
      { describeElement: () => null }
    );

    expect(errors).toContain('Цель #1: цвета «green» нет среди цветов уровня.');
  });

  it('gives a level without colors the classic five, not every chip color', () => {
    expect(normalizeMinigameLevelConfig({ id: 2, moves: 20 }).colors).toEqual([
      ...DEFAULT_LEVEL_COLORS,
    ]);
    expect(DEFAULT_LEVEL_COLORS).not.toContain('pink');
  });

  it('normalizes colors to known unique chips in canonical order', () => {
    expect(normalizeLevelColors(['blue', 'red', 'blue', 'cargo', 7, 'yellow'])).toEqual([
      'yellow',
      'red',
      'blue',
    ]);
  });

  it('requires at least two colors', () => {
    const errorText = 'На уровне должно быть не меньше 2 цветов фишек.';
    const twoColors = {
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      colors: ['red' as const, 'green' as const],
    };
    const oneColor = { ...INITIAL_MINIGAME_LEVEL_CONFIG, colors: ['red' as const] };

    expect(validateMinigameLevelConfig(twoColors)).not.toContain(errorText);
    expect(validateMinigameLevelConfig(oneColor)).toContain(errorText);
  });

  it('rejects chips and chip goals outside the level colors', () => {
    const config = {
      ...INITIAL_MINIGAME_LEVEL_CONFIG,
      colors: ['red' as const, 'green' as const, 'yellow' as const, 'blue' as const],
    };
    const errors = validateMinigameLevelConfig(config);

    // В пресете есть фиолетовые фишки - на 4 цветах без violet они вне палитры.
    expect(errors).toContain('Фишки в клетке (кол. 5, стр. 3) нет среди цветов уровня.');
    expect(errors.some((error) => error.startsWith('Цель #'))).toBe(false);
  });

  it('limits the grid size', () => {
    const config = { ...INITIAL_MINIGAME_LEVEL_CONFIG, grid: createEmptyMinigameGrid(10, 6) };

    expect(validateMinigameLevelConfig(config)).toContain('Размер поля - от 3×3 до 9×9 клеток.');
  });

  it('names columns as the editor draws them: the outer array is a column', () => {
    const grid = createEmptyMinigameGrid(4, 5);
    grid[2] = grid[2].slice(0, 3);

    expect(validateMinigameLevelConfig({ ...INITIAL_MINIGAME_LEVEL_CONFIG, grid })).toContain(
      'Колонка 3 имеет неверную длину.'
    );
  });

  it('resizes the grid keeping placed cells and leaving new ones empty', () => {
    const grid = [
      [{ id: 'red' }, { id: 'ice', innerId: 'green' }],
      [{ id: 'cargo' }, { id: 'blue' }],
    ];

    expect(resizeMinigameGrid(grid, 3, 1)).toEqual([
      [{ id: 'red' }],
      [{ id: 'cargo' }],
      [{ id: '' }],
    ]);
  });
});
