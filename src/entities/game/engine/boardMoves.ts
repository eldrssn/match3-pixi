import { hasBoardMatch, hasPossibleMove } from '../lib/boardMatches';
import type { IBoardShape } from '../lib/boardShapes';
import { findHintMove, type THintSwapPair } from '../lib/findHintMove';
import { isChipPiece, isDropPiece, isSpecialPiece, type TSpecialKind } from './boardPieces';
import type { BoardState } from './boardState';
import type { IBoardCellPos } from './boardSteps';

/**
 * Ходы на доске без их розыгрыша: есть ли ход, какие ходы движок примет и
 * какой из них лучший. Доска после любого вызова та же, что до него
 * (примерка обмена откатывается). Нужны тупику, подсказкам и боту.
 */

/**
 * Ценность хода для подсказки лучшего хода (`findBestMove`): фигура по виду -
 * та же лестница жанра, что у наград (`boardCascade`); свап спецфишки - по её
 * виду, две спецфишки - комбинация, ценнее любой фигуры.
 */
const MOVE_VALUE = {
  shape: { line5: 100, lt: 80, line4: 60, square: 50, line3: 10 } satisfies Record<
    IBoardShape['kind'],
    number
  >,
  special: { rainbow: 90, bomb: 60, laser: 50, propeller: 45 } satisfies Record<
    TSpecialKind,
    number
  >,
  combo: 150,
  /** Клетка фигуры, нужная цели уровня (`isPriorityTarget`). */
  priorityCell: 6,
} as const;

/**
 * Есть ли на доске ход фишками. Спецфишки ходом не считаются: они
 * срабатывают тапом в любой момент, и тупик подсвечивает их отдельно.
 */
export const hasMove = (board: BoardState): boolean => {
  const { iced, locked } = board.overlayLocks();

  return hasPossibleMove(
    board.grid,
    (piece) => isChipPiece(piece) && !iced.has(piece.uid),
    (piece) => (isChipPiece(piece) || isDropPiece(piece)) && !locked.has(piece.uid)
  );
};

/** Ход для подсказки простоя - от центра поля наружу. */
export const findHint = (board: BoardState): THintSwapPair | null => {
  const view = board.matchView();

  return findHintMove(
    view.map((column) => column.map((piece) => (piece && isChipPiece(piece) ? piece.id : null))),
    (col, row) => {
      const piece = board.grid[col]?.[row];

      return (
        piece !== null &&
        piece !== undefined &&
        (isChipPiece(piece) || isDropPiece(piece)) &&
        !board.overlays[col][row]
      );
    }
  );
};

/** Примет ли движок этот свап (`trySwap` вернул бы `accepted`). Доска не меняется. */
const isAcceptedSwap = (board: BoardState, from: IBoardCellPos, to: IBoardCellPos): boolean => {
  const first = board.cellAt(from);
  const second = board.cellAt(to);

  if (!first || !second || !board.isSwappableAt(from) || !board.isSwappableAt(to)) {
    return false;
  }

  if (isSpecialPiece(first) || isSpecialPiece(second)) {
    return true;
  }

  board.swapCells(from, to);

  const isMatch = hasBoardMatch(board.matchView(), isChipPiece);

  board.swapCells(from, to);

  return isMatch;
};

/** Ценность хода для `findBestMove`. Доска не меняется. */
const rateMove = (board: BoardState, from: IBoardCellPos, to: IBoardCellPos): number => {
  const first = board.cellAt(from);
  const second = board.cellAt(to);

  if (first && second && isSpecialPiece(first) && isSpecialPiece(second)) {
    return MOVE_VALUE.combo + MOVE_VALUE.special[first.id] + MOVE_VALUE.special[second.id];
  }

  if (first && isSpecialPiece(first)) {
    return MOVE_VALUE.special[first.id];
  }

  if (second && isSpecialPiece(second)) {
    return MOVE_VALUE.special[second.id];
  }

  // Фигура и её клетки читаются на доске после обмена: в клетках свапа уже
  // лежат фишки друг друга, а слои клеток (подложка) остаются свои.
  board.swapCells(from, to);

  const value = board.findShapes().reduce((sum, shape) => {
    const priorityCells = shape.cells.filter(
      (cell) => board.isPriorityTarget?.(board.layerIdsAt(cell)) ?? false
    ).length;

    return sum + MOVE_VALUE.shape[shape.kind] + priorityCells * MOVE_VALUE.priorityCell;
  }, 0);

  board.swapCells(from, to);

  return value;
};

/**
 * Все ходы свапом, которые движок примет: пара соседей, где хотя бы одна -
 * спецфишка, или обмен собирает фигуру. Доска не меняется. Нужна боту и
 * подсказке лучшего хода - игроку движок отвечает на конкретный свап.
 */
export const listMoves = (board: BoardState): THintSwapPair[] => {
  const moves: THintSwapPair[] = [];

  for (let col = 0; col < board.cols; col++) {
    for (let row = 0; row < board.rows; row++) {
      const from = { col, row };

      for (const to of [
        { col: col + 1, row },
        { col, row: row + 1 },
      ]) {
        if (board.isInside(to) && isAcceptedSwap(board, from, to)) {
          moves.push([from, to]);
        }
      }
    }
  }

  return moves;
};

/**
 * Лучший ход для подсказки: самая ценная фигура (радуга > бомба > ракета >
 * пропеллер > тройка) или свап спецфишки; при равенстве - тот, что больше
 * задевает нужное цели уровня (`isPriorityTarget`), затем ближе к центру
 * поля. Ход меряется фигурой, которая соберётся сразу после обмена, без
 * каскада: подсказка не подглядывает в добор.
 */
export const findBestMove = (board: BoardState): THintSwapPair | null => {
  const centerCol = (board.cols - 1) / 2;
  const centerRow = (board.rows - 1) / 2;
  let best: { move: THintSwapPair; value: number; distance: number } | null = null;

  for (const move of listMoves(board)) {
    const value = rateMove(board, move[0], move[1]);
    const distance =
      Math.abs(move[0].col + move[1].col - 2 * centerCol) +
      Math.abs(move[0].row + move[1].row - 2 * centerRow);

    if (!best || value > best.value || (value === best.value && distance < best.distance)) {
      best = { move, value, distance };
    }
  }

  return best?.move ?? null;
};
