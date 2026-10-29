import type { TRandom } from '@/shared/lib/random';
import type { IMinigameLevelCell } from '../types';
import { isMinigameChipId, MINIGAME_RANDOM_ID, type TMinigameChipId } from './minigameLevelConfig';

/**
 * Клетки «?» уровня -> фишки цветов уровня.
 *
 * Цвет берётся случайно (от зерна партии), но такой, чтобы клетка не
 * достроила готовую фигуру - линию из трёх или квадрат 2×2 - ни с
 * фиксированными фишками уровня, ни с уже разыгранными «?». Уровень с
 * готовой фигурой на старте - баг: рантайм её не разбирает. Если безопасного
 * цвета нет (два-три цвета и плотные соседи), клетка берёт любой - такую раскладку
 * отбракует вызывающий по готовой фигуре или отсутствию хода.
 *
 * Фишка подо льдом в линию не идёт, поэтому «?» подо льдом берёт любой цвет.
 * Ось - `grid[col][row]`. Исходное поле не меняется.
 */
export const resolveRandomCells = (
  grid: readonly (readonly IMinigameLevelCell[])[],
  colors: readonly TMinigameChipId[],
  random: TRandom
): IMinigameLevelCell[][] => {
  const result = grid.map((column) => column.map((cell) => ({ ...cell })));
  const cols = result.length;
  const rows = result[0]?.length ?? 0;

  const colorAt = (col: number, row: number): string | null => {
    const cell = col >= 0 && col < cols && row >= 0 && row < rows ? result[col][row] : null;

    return cell && isMinigameChipId(cell.id) && cell.overlay !== 'ice' ? cell.id : null;
  };

  /** Встанет ли `color` в клетку фигурой: все клетки окна, кроме самой, - этого цвета. */
  const closesWindow = (
    col: number,
    row: number,
    color: string,
    window: readonly [number, number][]
  ): boolean =>
    window.every(([c, r]) =>
      c === col && r === row
        ? true
        : c >= 0 && c < cols && r >= 0 && r < rows && colorAt(c, r) === color
    );

  const formsShape = (col: number, row: number, color: string): boolean => {
    for (let offset = -2; offset <= 0; offset++) {
      const horizontal: [number, number][] = [0, 1, 2].map((i) => [col + offset + i, row]);
      const vertical: [number, number][] = [0, 1, 2].map((i) => [col, row + offset + i]);

      if (closesWindow(col, row, color, horizontal) || closesWindow(col, row, color, vertical)) {
        return true;
      }
    }

    for (const [dCol, dRow] of [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 0],
    ] as const) {
      const left = col + dCol;
      const top = row + dRow;
      const square: [number, number][] = [
        [left, top],
        [left + 1, top],
        [left, top + 1],
        [left + 1, top + 1],
      ];

      if (closesWindow(col, row, color, square)) {
        return true;
      }
    }

    return false;
  };

  const shuffled = (): TMinigameChipId[] => {
    const order = [...colors];

    for (let index = order.length - 1; index > 0; index--) {
      const swapWith = Math.floor(random() * (index + 1));

      [order[index], order[swapWith]] = [order[swapWith], order[index]];
    }

    return order;
  };

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cell = result[col][row];

      if (cell.id !== MINIGAME_RANDOM_ID) {
        continue;
      }

      const order = shuffled();
      const isIced = cell.overlay === 'ice';

      cell.id = (isIced ? null : order.find((color) => !formsShape(col, row, color))) ?? order[0];
    }
  }

  return result;
};
