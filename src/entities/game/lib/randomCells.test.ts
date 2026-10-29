import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@/shared/lib/random';
import { BoardEngine } from '../engine/BoardEngine';
import type { IMinigameLevelCell } from '../types';
import { hasBoardMatch } from './boardMatches';
import { isMinigameChipId, MINIGAME_CHIP_IDS, type TMinigameChipId } from './minigameLevelConfig';
import { resolveRandomCells } from './randomCells';

const isChipCell = (cell: IMinigameLevelCell): boolean =>
  isMinigameChipId(cell.id) && cell.overlay !== 'ice';

/** Поле `cols × rows` из одних «?». */
const randomField = (cols: number, rows: number): IMinigameLevelCell[][] =>
  Array.from({ length: cols }, () => Array.from({ length: rows }, () => ({ id: 'random' })));

describe('resolveRandomCells', () => {
  it('каждая «?» становится фишкой цвета уровня, без готовой фигуры', () => {
    const colors: TMinigameChipId[] = ['red', 'green', 'blue', 'yellow'];

    for (let seed = 1; seed <= 30; seed++) {
      const grid = resolveRandomCells(randomField(7, 7), colors, createSeededRandom(seed));

      expect(grid.flat().every((cell) => colors.includes(cell.id as TMinigameChipId))).toBe(true);
      expect(hasBoardMatch(grid, isChipCell), `seed ${seed}`).toBe(false);
    }
  });

  it('не достраивает фигуру с фиксированными фишками уровня', () => {
    // Две красные сверху и квадрат-заготовка: «?» не имеет права стать красной.
    const grid: IMinigameLevelCell[][] = [
      [{ id: 'red' }, { id: 'red' }, { id: 'random' }],
      [{ id: 'green' }, { id: 'blue' }, { id: 'green' }],
      [{ id: 'blue' }, { id: 'green' }, { id: 'blue' }],
    ];

    for (let seed = 1; seed <= 20; seed++) {
      const [column] = resolveRandomCells(grid, ['red', 'green', 'blue'], createSeededRandom(seed));

      expect(column[2].id).not.toBe('red');
    }
  });

  it('поле и накладки не трогает, одно зерно - одна раскладка', () => {
    const grid: IMinigameLevelCell[][] = [
      [{ id: 'random', overlay: 'ice', floor: 1 }, { id: 'HOLE' }],
    ];
    const first = resolveRandomCells(grid, [...MINIGAME_CHIP_IDS], createSeededRandom(5));
    const second = resolveRandomCells(grid, [...MINIGAME_CHIP_IDS], createSeededRandom(5));

    expect(grid[0][0].id).toBe('random');
    expect(first).toEqual(second);
    expect(first[0][0]).toMatchObject({ overlay: 'ice', floor: 1 });
    expect(first[0][1]).toEqual({ id: 'HOLE' });
  });

  it('движок собирает доску из «?» с ходом на старте', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const engine = BoardEngine.fromLevel(randomField(5, 5), {
        colors: ['red', 'green', 'blue'],
        random: createSeededRandom(seed),
      });

      expect(engine.hasMove(), `seed ${seed}`).toBe(true);
    }
  });
});
