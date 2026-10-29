import { planBoardGravity } from '../lib/boardGravity';
import type { IBoardShape } from '../lib/boardShapes';
import { damageCells, withSplash } from './boardDamage';
import {
  isChipPiece,
  isDropPiece,
  isHolePiece,
  type TBoardPiece,
  type TLaserDirection,
  type TSpecialKind,
} from './boardPieces';
import { sameCell, type BoardState } from './boardState';
import type { IBoardCellPos, IBoardMove, IBoardSpawn, TBoardStep } from './boardSteps';

/**
 * Каскад и оседание - правило движка доски: фигуры гаснут и оставляют
 * награду, доска падает с диагональным осыпанием под неподвижные клетки,
 * добирается фишками цветов уровня, «опусти вниз» на дне собираются - и так,
 * пока собираются новые фигуры.
 */

/** Защита от бесконечного каскада: на реальной доске цепочка гаснет за единицы звеньев. */
const MAX_CASCADE_ITERATIONS = 50;

/** Спецфишка за вид фигуры (`boardShapes`); линия из трёх награды не даёт. */
const SPECIAL_FOR_SHAPE: Record<IBoardShape['kind'], TSpecialKind | null> = {
  line5: 'rainbow',
  lt: 'bomb',
  line4: 'laser',
  square: 'propeller',
  line3: null,
};

/** Где и какая спецфишка родится за фигуру. */
interface ISpecialPlan {
  kind: TSpecialKind;
  cell: IBoardCellPos;
  direction: TLaserDirection;
}

/**
 * Один проход гравитации (`planBoardGravity`): подвижные предметы падают и
 * соскальзывают под неподвижные, пустые клетки добираются фишками цветов
 * уровня.
 */
const settleOnce = (board: BoardState): Extract<TBoardStep, { type: 'settle' }> => {
  const slotAt = (col: number, row: number) => board.slotAt(col, row);
  const movable = board.grid.map((column, col) =>
    column.map((piece, row) => (slotAt(col, row) === 'open' ? piece : null))
  );
  const plan = planBoardGravity<TBoardPiece>(movable, slotAt, () =>
    board.createChip(board.pickColor())
  );
  const moves: IBoardMove[] = [];
  const spawns: IBoardSpawn[] = [];

  for (let col = 0; col < board.cols; col++) {
    for (let row = 0; row < board.rows; row++) {
      if (slotAt(col, row) === 'open') {
        board.grid[col][row] = plan.grid[col][row];
      }
    }
  }

  for (const { cell, from, path, inPlace } of plan.moves) {
    const last = path[path.length - 1];

    if (from.row >= 0 && !inPlace) {
      moves.push({ uid: cell.uid, from, path });
    } else if (isChipPiece(cell)) {
      const spawn: IBoardSpawn = { col: last.col, row: last.row, piece: { ...cell }, path };

      if (inPlace) {
        spawn.inPlace = true;
      }

      spawns.push(spawn);
    }
  }

  return { type: 'settle', moves, spawns };
};

/** «Опусти вниз» на дне своей колонки (ниже - только дыры) собираются. */
const collectDrops = (board: BoardState): number[] => {
  const collected: number[] = [];

  for (let col = 0; col < board.cols; col++) {
    for (let row = board.rows - 1; row >= 0; row--) {
      const piece = board.grid[col][row];

      if (piece && isHolePiece(piece)) {
        continue;
      }

      if (piece && isDropPiece(piece)) {
        board.grid[col][row] = null;
        collected.push(piece.uid);
      }

      break;
    }
  }

  return collected;
};

/**
 * Гравитация, добор и сбор «опусти вниз» до устойчивого поля: собранный
 * предмет освобождает клетку, и доска оседает ещё раз.
 */
export const settle = (board: BoardState): { steps: TBoardStep[]; moved: ReadonlySet<number> } => {
  const steps: TBoardStep[] = [];
  const moved = new Set<number>();

  for (let pass = 0; pass <= board.cols * board.rows; pass++) {
    const settled = settleOnce(board);

    steps.push(settled);
    settled.moves.forEach((move) => moved.add(move.uid));
    settled.spawns.forEach((spawn) => moved.add(spawn.piece.uid));

    const collected = collectDrops(board);

    if (collected.length === 0) {
      break;
    }

    steps.push({ type: 'collect', uids: collected });
  }

  return { steps, moved };
};

/**
 * Где родится награда за фигуру: в клетке свапа, если она в фигуре; у L/T -
 * на пересечении; в каскаде - в клетке самой нижней фишки, только что
 * упавшей в фигуру; иначе - в средней клетке фигуры. Клетки под накладками
 * не годятся: фишка там матчем не гаснет (удар принимает цепь).
 */
const planSpecial = (
  board: BoardState,
  shape: IBoardShape,
  origins: readonly IBoardCellPos[],
  moved: ReadonlySet<number>
): ISpecialPlan | null => {
  const kind = SPECIAL_FOR_SHAPE[shape.kind];
  const cells = shape.cells.filter((cell) => !board.overlays[cell.col][cell.row]);

  if (!kind || cells.length === 0) {
    return null;
  }

  const contains = (pos: IBoardCellPos | null) =>
    pos !== null && cells.some((cell) => sameCell(cell, pos));
  const origin = origins.find((pos) => contains(pos));
  const fallen = cells
    .filter((cell) => {
      const piece = board.cellAt(cell);

      return piece !== null && moved.has(piece.uid);
    })
    .sort((a, b) => b.row - a.row || a.col - b.col)[0];
  const middle = cells[Math.floor((cells.length - 1) / 2)];

  return {
    kind,
    cell: origin ?? (contains(shape.intersection) ? shape.intersection : null) ?? fallen ?? middle,
    direction: shape.axis ?? 'horizontal',
  };
};

const spawnSpecial = (board: BoardState, plan: ISpecialPlan): TBoardStep | null => {
  if (board.cellAt(plan.cell) !== null) {
    return null;
  }

  const piece = board.createSpecial(plan.kind, plan.direction);

  board.grid[plan.cell.col][plan.cell.row] = piece;

  return { type: 'special', placement: { ...plan.cell, piece: { ...piece } } };
};

/**
 * Каскад: фигуры гаснут, задевая брызгом соседние ящики и лёд; ценная
 * фигура оставляет спецфишку (`planSpecial`); доска оседает и добирается -
 * и так, пока новые фигуры собираются.
 *
 * `origins` - клетки свапа (куда довёл и откуда): награда в первом звене
 * рождается в них. `movedBefore` - фишки, сдвинутые оседанием перед первым
 * звеном (после взрыва спецфишки).
 */
export const resolveCascade = (
  board: BoardState,
  origins: readonly IBoardCellPos[],
  movedBefore: ReadonlySet<number>
): TBoardStep[] => {
  const steps: TBoardStep[] = [];
  let shapes = board.findShapes();
  let moved = movedBefore;
  let iteration = 0;

  while (shapes.length > 0 && iteration < MAX_CASCADE_ITERATIONS) {
    iteration++;

    // Клетка свапа даёт место награде только в первом звене: дальше каскад
    // гасит фишки уже не там, куда игрок довёл свою. План - до урона: после
    // него фишек фигуры в гриде уже нет.
    const plans = shapes.map((shape) =>
      planSpecial(board, shape, iteration === 1 ? origins : [], moved)
    );

    steps.push(
      damageCells(
        board,
        withSplash(
          board,
          shapes.flatMap((shape) => shape.cells)
        )
      )
    );
    steps.push({ type: 'matches', iteration, groups: shapes.map((shape) => shape.cells) });

    for (const plan of plans) {
      const step = plan ? spawnSpecial(board, plan) : null;

      if (step) {
        steps.push(step);
      }
    }

    const settled = settle(board);

    steps.push(...settled.steps);
    moved = settled.moved;
    shapes = board.findShapes();

    if (shapes.length === 0) {
      break;
    }

    steps.push({ type: 'cascadePause', iteration });
  }

  return steps;
};

/** Оседание после взрыва и каскад, который оно соберёт. */
export const settleAndCascade = (
  board: BoardState,
  origins: readonly IBoardCellPos[]
): TBoardStep[] => {
  const { steps, moved } = settle(board);

  return [...steps, ...resolveCascade(board, origins, moved)];
};
