import { describe, expect, it } from 'vitest';
import { hasBoardMatch, hasPossibleMove } from './boardMatches';
import {
  DEFAULT_LEVEL_COLORS,
  isMinigameChipId,
  MINIGAME_CHIP_IDS,
  type TMinigameChipId,
} from './minigameLevelConfig';
import {
  generateMinigameLevelGrid,
  readMinigameGridSize,
  regenerateMinigameGridChips,
  DEFAULT_MINIGAME_GRID_COLS,
  DEFAULT_MINIGAME_GRID_ROWS,
} from './minigameLevelGrid';
import type { IMinigameLevelCell, IMinigameLevelConfig, IMinigameLevelGoal } from '../types';

/** Воспроизводимый источник случайности: без него тест ловил бы раскладку раз через раз. */
const seededRandom = (seed: number): (() => number) => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const isChip = (cell: IMinigameLevelCell): boolean => isMinigameChipId(cell.id);

const countCells = (grid: IMinigameLevelCell[][], id: string): number =>
  grid.flat().filter((cell) => cell.id === id).length;

const config = (
  cols: number,
  rows: number,
  levelGoals: IMinigameLevelGoal[],
  colors: TMinigameChipId[] = [...MINIGAME_CHIP_IDS]
): IMinigameLevelConfig => ({
  formatVersion: 2,
  id: 1,
  moves: 15,
  colors,
  levelGoals,
  grid: Array.from({ length: cols }, () => Array.from({ length: rows }, () => ({ id: '' }))),
});

describe('readMinigameGridSize', () => {
  it('читает размер поля черновика', () => {
    expect(readMinigameGridSize(config(7, 5, []))).toEqual({ cols: 7, rows: 5 });
  });

  it('подставляет размер по умолчанию, если поля ещё нет', () => {
    expect(readMinigameGridSize({ ...config(0, 0, []), grid: [] })).toEqual({
      cols: DEFAULT_MINIGAME_GRID_COLS,
      rows: DEFAULT_MINIGAME_GRID_ROWS,
    });
  });
});

describe('generateMinigameLevelGrid', () => {
  it('сохраняет размер поля', () => {
    const { grid } = generateMinigameLevelGrid(config(7, 5, []), seededRandom(1));

    expect(grid).toHaveLength(7);
    expect(grid.every((column) => column.length === 5)).toBe(true);
  });

  it('не оставляет на поле готовых комбинаций и всегда оставляет ход', () => {
    // Прогон по разным зёрнам: гарантия конструктивная, а не «повезло с одним».
    for (let seed = 1; seed <= 40; seed++) {
      const { grid, hasMove } = generateMinigameLevelGrid(
        config(6, 6, [{ id: 'red', count: 15 }]),
        seededRandom(seed)
      );

      expect(hasBoardMatch(grid, isChip)).toBe(false);
      expect(hasPossibleMove(grid, isChip)).toBe(true);
      expect(hasMove).toBe(true);
    }
  });

  it('заполняет поле только фишками, если целей по блокерам нет', () => {
    const { grid } = generateMinigameLevelGrid(config(6, 6, []), seededRandom(7));

    expect(grid.flat().every(isChip)).toBe(true);
  });

  it('сеет фишки цвета цели, чтобы цель начинала собираться сразу', () => {
    const { grid, skippedGoalCells } = generateMinigameLevelGrid(
      config(6, 6, [
        { id: 'violet', count: 10 },
        { id: 'blue', count: 5 },
      ]),
      seededRandom(3)
    );

    expect(countCells(grid, 'violet')).toBeGreaterThanOrEqual(3);
    expect(countCells(grid, 'blue')).toBeGreaterThanOrEqual(3);
    expect(skippedGoalCells).toBe(0);
  });

  it('кладёт на поле все блокеры цели: сами они не выпадают', () => {
    const { grid, skippedGoalCells } = generateMinigameLevelGrid(
      config(6, 6, [{ id: 'cargo', count: 8 }]),
      seededRandom(5)
    );

    expect(countCells(grid, 'cargo')).toBe(8);
    expect(skippedGoalCells).toBe(0);
  });

  it('не забивает поле блокерами целиком и сообщает, сколько не поместилось', () => {
    const { grid, skippedGoalCells } = generateMinigameLevelGrid(
      config(6, 6, [{ id: 'cargo', count: 40 }]),
      seededRandom(11)
    );

    expect(countCells(grid, 'cargo')).toBe(24);
    expect(skippedGoalCells).toBe(16);
    expect(grid.flat().filter(isChip)).toHaveLength(12);
  });

  it('повторяет раскладку от переданного источника случайности', () => {
    const first = generateMinigameLevelGrid(config(6, 6, []), seededRandom(42));
    const second = generateMinigameLevelGrid(config(6, 6, []), seededRandom(42));

    expect(first.grid).toEqual(second.grid);
  });

  it('берёт фишки только из цветов уровня', () => {
    const colors: TMinigameChipId[] = ['red', 'green', 'blue'];

    for (let seed = 1; seed <= 20; seed++) {
      const { grid, hasMove } = generateMinigameLevelGrid(
        config(7, 7, [], colors),
        seededRandom(seed)
      );
      const used = new Set(grid.flat().map((cell) => cell.id));

      expect([...used].every((id) => colors.includes(id as TMinigameChipId))).toBe(true);
      expect(hasBoardMatch(grid, isChip)).toBe(false);
      expect(hasMove).toBe(true);
    }
  });

  it('черновик с недобранными цветами строит на цветах по умолчанию, без розового', () => {
    const { grid } = generateMinigameLevelGrid(config(7, 7, [], ['red']), seededRandom(4));
    const used = new Set(grid.flat().map((cell) => cell.id));

    expect([...used].every((id) => DEFAULT_LEVEL_COLORS.includes(id as TMinigameChipId))).toBe(
      true
    );
    expect(used.has('pink')).toBe(false);
  });
});

describe('генерация на двух цветах', () => {
  it('и с нуля, и перекраской даёт поле без готовых фигур, с ходом и только из цветов уровня', () => {
    const colors: TMinigameChipId[] = ['red', 'blue'];

    for (let seed = 1; seed <= 30; seed++) {
      const random = seededRandom(seed);
      const generated = generateMinigameLevelGrid(config(7, 7, [], colors), random);
      const regenerated = regenerateMinigameGridChips(
        { ...config(7, 7, [], colors), grid: generated.grid },
        random
      );

      for (const { grid, hasMove } of [generated, regenerated]) {
        expect(hasBoardMatch(grid, isChip)).toBe(false);
        expect(hasMove).toBe(true);
        expect(grid.flat().every((cell) => colors.includes(cell.id as TMinigameChipId))).toBe(true);
      }
    }
  });
});

describe('regenerateMinigameGridChips', () => {
  /** Правило матча генератора: фишка подо льдом линию не продолжает. */
  const isMatchable = (cell: IMinigameLevelCell): boolean => isChip(cell) && cell.overlay !== 'ice';

  /**
   * Ручная раскладка 7x7: дыры, блокеры, спецфишки, накладки и подложки
   * вперемешку с фишками, которые уже стоят готовыми тройками, и пустыми
   * клетками.
   */
  const handmade = (colors?: TMinigameChipId[]): IMinigameLevelConfig => {
    const level = config(7, 7, [{ id: 'red', count: 20 }], colors);

    level.grid = level.grid.map((column) => column.map(() => ({ id: 'red' })));
    level.grid[0][0] = { id: 'HOLE' };
    level.grid[6][6] = { id: 'HOLE' };
    level.grid[1][1] = { id: 'cargo', layers: 2, floor: 1 };
    level.grid[2][3] = { id: 'stone' };
    level.grid[4][2] = { id: 'slime' };
    level.grid[5][0] = { id: 'drop' };
    level.grid[3][5] = { id: 'random' };
    level.grid[0][4] = { id: 'laser', direction: 'vertical' };
    level.grid[6][1] = { id: 'bomb' };
    level.grid[3][3] = { id: 'red', overlay: 'ice', floor: 2 };
    level.grid[4][4] = { id: 'blue', overlay: 'chain' };
    level.grid[5][5] = { id: '', floor: 1 };
    level.grid[2][6] = { id: '' };

    return level;
  };

  const FIXED_KEYS = ['0,0', '6,6', '1,1', '2,3', '4,2', '5,0', '3,5', '0,4', '6,1'];

  const cellAt = (grid: IMinigameLevelCell[][], key: string): IMinigameLevelCell => {
    const [col, row] = key.split(',').map(Number);

    return grid[col][row];
  };

  it('не трогает клетки, которые не фишки, и сохраняет размер поля', () => {
    const level = handmade();
    const before = structuredClone(level.grid);
    const { grid } = regenerateMinigameGridChips(level, seededRandom(3));

    expect(grid).toHaveLength(7);
    expect(grid.every((column) => column.length === 7)).toBe(true);
    FIXED_KEYS.forEach((key) => expect(cellAt(grid, key)).toEqual(cellAt(before, key)));
    // Исходный черновик не мутируется.
    expect(level.grid).toEqual(before);
  });

  it('у перекрашенной клетки меняет только цвет: накладка и подложка остаются', () => {
    const { grid } = regenerateMinigameGridChips(handmade(), seededRandom(5));

    expect(cellAt(grid, '3,3')).toMatchObject({ overlay: 'ice', floor: 2 });
    expect(cellAt(grid, '4,4')).toMatchObject({ overlay: 'chain' });
    expect(Object.keys(cellAt(grid, '4,4')).sort()).toEqual(['id', 'overlay']);
  });

  it('заполняет пустые клетки фишками, сохраняя подложку', () => {
    const { grid } = regenerateMinigameGridChips(handmade(), seededRandom(9));

    expect(isChip(cellAt(grid, '5,5'))).toBe(true);
    expect(cellAt(grid, '5,5').floor).toBe(1);
    expect(isChip(cellAt(grid, '2,6'))).toBe(true);
    expect(grid.flat().some((cell) => cell.id === '')).toBe(false);
  });

  it('берёт цвета уровня, не оставляет готовых комбинаций и оставляет ход', () => {
    const colors: TMinigameChipId[] = ['red', 'green', 'blue', 'yellow'];

    for (let seed = 1; seed <= 30; seed++) {
      const { grid, hasMove, skippedGoalCells } = regenerateMinigameGridChips(
        handmade(colors),
        seededRandom(seed)
      );
      const chips = grid.flat().filter(isChip);

      expect(chips.every((cell) => colors.includes(cell.id as TMinigameChipId))).toBe(true);
      expect(hasBoardMatch(grid, isMatchable)).toBe(false);
      expect(hasMove).toBe(true);
      expect(skippedGoalCells).toBe(0);
    }
  });

  it('повторяет раскладку от переданного источника случайности', () => {
    const first = regenerateMinigameGridChips(handmade(), seededRandom(42));
    const second = regenerateMinigameGridChips(handmade(), seededRandom(42));

    expect(first.grid).toEqual(second.grid);
  });
});
