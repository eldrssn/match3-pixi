import { isDropPiece, isHolePiece, isSlimePiece, type TBoardPiece } from './boardPieces';
import { cellKey, NEIGHBOR_OFFSETS, type BoardState } from './boardState';
import type { IBoardCellPos, IBoardHit, TBoardStep } from './boardSteps';

/**
 * Урон по клеткам - правило движка доски без анимаций и без спецфишек.
 *
 * Урон по клетке идёт сверху вниз: накладка принимает удар на себя (лёд -
 * любой, цепь - только прямой), иначе предмет (фишка и спецфишка - прямой,
 * ящик и слизь - любой, камень - прямой от спецфишки или бустера, «опусти
 * вниз» - никакой), и если предмет на клетке погас - слой подложки. Что
 * делать со спецфишкой под ударом (взорвать её), решает `boardDetonation`.
 */

/**
 * Как удар достаётся клетке: прямо (матч на ней, взрыв по ней) или брызгом
 * от соседней (матч рядом). Брызг берут только ящик, слизь и лёд.
 */
export type THitKind = 'direct' | 'splash';

export interface ICellHit {
  pos: IBoardCellPos;
  kind: THitKind;
}

export const direct = (pos: IBoardCellPos): ICellHit => ({ pos, kind: 'direct' });

const isHoleCell = (piece: TBoardPiece | null): boolean => piece !== null && isHolePiece(piece);

/** Берёт ли предмет удар: брызг - только ящик и слизь, «опусти вниз» - никакой. */
const takesHit = (piece: TBoardPiece, kind: THitKind): boolean => {
  if (isDropPiece(piece)) {
    return false;
  }

  return kind === 'direct' || piece.id === 'cargo' || isSlimePiece(piece);
};

/** Удар по клетке сверху вниз: накладка, иначе предмет и под ним подложка. */
const hitCell = (board: BoardState, pos: IBoardCellPos, kind: THitKind): IBoardHit[] => {
  const piece = board.cellAt(pos);

  if (piece && isHolePiece(piece)) {
    return [];
  }

  const overlay = board.overlays[pos.col][pos.row];

  if (overlay) {
    if (kind === 'splash' && overlay.id !== 'ice') {
      return [];
    }

    overlay.hp -= 1;

    if (overlay.hp <= 0) {
      board.overlays[pos.col][pos.row] = null;
    }

    return [
      {
        uid: overlay.uid,
        id: overlay.id,
        layer: 'overlay',
        hp: Math.max(0, overlay.hp),
        destroyed: overlay.hp <= 0,
      },
    ];
  }

  const hits: IBoardHit[] = [];
  let cleared = piece === null;

  if (piece && takesHit(piece, kind)) {
    piece.hp -= 1;
    cleared = piece.hp <= 0;

    if (cleared) {
      board.grid[pos.col][pos.row] = null;
    }

    hits.push({
      uid: piece.uid,
      id: piece.id,
      layer: 'piece',
      hp: Math.max(0, piece.hp),
      destroyed: cleared,
    });
  }

  const floor = board.floors[pos.col][pos.row];

  if (floor && kind === 'direct' && cleared) {
    floor.hp -= 1;

    if (floor.hp <= 0) {
      board.floors[pos.col][pos.row] = null;
    }

    hits.push({
      uid: floor.uid,
      id: floor.id,
      layer: 'floor',
      hp: Math.max(0, floor.hp),
      destroyed: floor.hp <= 0,
    });
  }

  return hits;
};

/**
 * Удары одного события, по одному на клетку: прямой перекрывает брызг.
 * Повторы схлопываются - ящик, соседний сразу с двумя гаснущими фишками,
 * получает за событие один удар, а не два.
 */
export const damageCells = (board: BoardState, hits: readonly ICellHit[]): TBoardStep => {
  const byCell = new Map<string, ICellHit>();

  for (const hit of hits) {
    const key = cellKey(hit.pos);
    const known = byCell.get(key);

    if (board.isInside(hit.pos) && (!known || hit.kind === 'direct')) {
      byCell.set(key, hit);
    }
  }

  return {
    type: 'damage',
    hits: [...byCell.values()].flatMap(({ pos, kind }) => hitCell(board, pos, kind)),
  };
};

/** Прямые удары по клеткам и брызг по их соседям (не дыры, не сами клетки). */
export const withSplash = (board: BoardState, cells: readonly IBoardCellPos[]): ICellHit[] => {
  const inside = cells.filter((cell) => board.isInside(cell) && !isHoleCell(board.cellAt(cell)));
  const directKeys = new Set(inside.map(cellKey));
  const splash: ICellHit[] = [];

  for (const cell of inside) {
    for (const offset of NEIGHBOR_OFFSETS) {
      const neighbor = { col: cell.col + offset.col, row: cell.row + offset.row };

      if (board.isInside(neighbor) && !directKeys.has(cellKey(neighbor))) {
        splash.push({ pos: neighbor, kind: 'splash' });
      }
    }
  }

  return [...inside.map(direct), ...splash];
};
