import type { TRandom } from '@/shared/lib/random';
import type { TGravitySlot } from '../lib/boardGravity';
import { findBoardShapes, type IBoardShape } from '../lib/boardShapes';
import type { TMinigameChipId } from '../lib/minigameLevelConfig';
import type { IReshuffleCell } from '../lib/reshuffleLayout';
import {
  BOARD_PIECE_HP,
  canSwapPiece,
  isChipPiece,
  isHolePiece,
  isStaticPiece,
  type IBoardCellSeed,
  type IChipPiece,
  type IFloorPiece,
  type IOverlayPiece,
  type TBoardPiece,
  type TLaserDirection,
  type TSpecialKind,
  type TSpecialPiece,
} from './boardPieces';
import type { IBoardCellPos } from './boardSteps';

export interface IBoardStateOptions {
  /** Цвета добора - цвета уровня (`IMinigameLevelConfig.colors`). */
  colors: readonly TMinigameChipId[];
  /** Источник случайности добора, перемешки и целей пропеллера - зерно партии. */
  random: TRandom;
  /**
   * Приоритетная цель пропеллера - то, что ещё нужно цели уровня. Целей движок
   * не знает, поэтому спрашивает рантайм в момент полёта, отдавая коды слоёв
   * клетки (предмет, накладка, `floor`). Без предиката пропеллер летит в
   * блокер, затем в фишку.
   */
  isPriorityTarget?: (ids: readonly string[]) => boolean;
}

export const NEIGHBOR_OFFSETS: readonly IBoardCellPos[] = [
  { col: -1, row: 0 },
  { col: 1, row: 0 },
  { col: 0, row: -1 },
  { col: 0, row: 1 },
];

export type TPiecePositions = ReadonlyMap<number, IBoardCellPos>;

export const sameCell = (a: IBoardCellPos, b: IBoardCellPos): boolean =>
  a.col === b.col && a.row === b.row;

export const cellKey = (pos: IBoardCellPos): string => `${pos.col}:${pos.row}`;

/**
 * Состояние доски движка и примитивы над ним: слои клеток (`grid[col][row]` -
 * предметы, `overlays` - накладки, `floors` - подложки), паспорта, случайность
 * партии и чтение доски, которое нужно всем правилам.
 *
 * Внутренняя кухня `engine/`, наружу (баррель) не торчит. Правила - функции
 * над этим состоянием в соседних модулях (`boardDamage`, `boardDetonation`,
 * `boardCascade`, `boardSlime`, `boardMoves`), публичный API - фасад
 * `BoardEngine`. Порядок обращений к `random` и выдачи паспортов - часть
 * контракта: с тем же зерном партия обязана повторяться до клетки.
 */
export class BoardState {
  /** Число колонок (ось X). */
  readonly cols: number;
  /** Число строк (ось Y). */
  readonly rows: number;

  readonly grid: (TBoardPiece | null)[][];
  readonly overlays: (IOverlayPiece | null)[][];
  readonly floors: (IFloorPiece | null)[][];
  readonly colors: readonly TMinigameChipId[];
  readonly random: TRandom;
  readonly isPriorityTarget: ((ids: readonly string[]) => boolean) | null;
  private nextUid = 1;

  /** Доска из готовых клеток: `cells[col][row]`. Паспорта выдаёт состояние. */
  constructor(
    cells: readonly (readonly IBoardCellSeed[])[],
    { colors, random, isPriorityTarget }: IBoardStateOptions
  ) {
    if (colors.length === 0) {
      throw new Error('BoardEngine: the level has no chip colors');
    }

    this.cols = cells.length;
    this.rows = cells[0]?.length ?? 0;
    this.colors = [...colors];
    this.random = random;
    this.isPriorityTarget = isPriorityTarget ?? null;

    const seedAt = (col: number, row: number): IBoardCellSeed => {
      const seed = cells[col]?.[row];

      if (!seed) {
        throw new Error(`BoardEngine: missing cell ${col}:${row}`);
      }

      return seed;
    };

    this.grid = this.buildLayer((col, row) => {
      const { piece } = seedAt(col, row);

      return piece ? { ...piece, uid: this.issueUid() } : null;
    });
    this.overlays = this.buildLayer((col, row) => {
      const { overlay } = seedAt(col, row);

      return overlay ? { ...overlay, uid: this.issueUid() } : null;
    });
    this.floors = this.buildLayer((col, row) => {
      const { floor } = seedAt(col, row);

      return floor ? { ...floor, uid: this.issueUid() } : null;
    });
  }

  // ---------------------------------------------------------------- чтение

  /** Живой предмет клетки - для правил движка; наружу - `BoardEngine.pieceAt`. */
  cellAt(pos: IBoardCellPos): TBoardPiece | null {
    return this.grid[pos.col]?.[pos.row] ?? null;
  }

  overlayAt(pos: IBoardCellPos): IOverlayPiece | null {
    return this.overlays[pos.col]?.[pos.row] ?? null;
  }

  floorAt(pos: IBoardCellPos): IFloorPiece | null {
    return this.floors[pos.col]?.[pos.row] ?? null;
  }

  /** Клетка предмета по паспорту; `null` - предмета на доске больше нет. */
  locate(uid: number): IBoardCellPos | null {
    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[col][row]?.uid === uid) {
          return { col, row };
        }
      }
    }

    return null;
  }

  isInside(pos: IBoardCellPos): boolean {
    return pos.col >= 0 && pos.col < this.cols && pos.row >= 0 && pos.row < this.rows;
  }

  /** Вид клетки для гравитации: дыра, неподвижная (блокер, накладка) или открытая. */
  slotAt(col: number, row: number): TGravitySlot {
    const piece = this.grid[col][row];

    if (piece && isHolePiece(piece)) {
      return 'hole';
    }

    if (this.overlays[col][row] || (piece && isStaticPiece(piece))) {
      return 'fixed';
    }

    return 'open';
  }

  /** Клетку можно сдвинуть свапом: подвижный предмет без накладки. */
  isSwappableAt(pos: IBoardCellPos): boolean {
    const piece = this.cellAt(pos);

    return piece !== null && canSwapPiece(piece) && !this.overlays[pos.col][pos.row];
  }

  /** Паспорта фишек под накладками: подо льдом - вне линий, под любой - на месте. */
  overlayLocks(): { iced: Set<number>; locked: Set<number> } {
    const iced = new Set<number>();
    const locked = new Set<number>();

    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        const overlay = this.overlays[col][row];
        const piece = this.grid[col][row];

        if (overlay && piece) {
          locked.add(piece.uid);

          if (overlay.id === 'ice') {
            iced.add(piece.uid);
          }
        }
      }
    }

    return { iced, locked };
  }

  /** Поле для правил линий: фишки подо льдом в линию не идут. */
  matchView(): (TBoardPiece | null)[][] {
    return this.grid.map((column, col) =>
      column.map((piece, row) => (this.overlays[col][row]?.id === 'ice' ? null : piece))
    );
  }

  findShapes(): IBoardShape[] {
    return findBoardShapes(this.matchView(), isChipPiece);
  }

  /** Коды слоёв клетки сверху вниз: накладка, предмет, подложка. */
  layerIdsAt(pos: IBoardCellPos): string[] {
    const ids: string[] = [];
    const overlay = this.overlays[pos.col][pos.row];
    const piece = this.cellAt(pos);
    const floor = this.floors[pos.col][pos.row];

    if (overlay) ids.push(overlay.id);
    if (piece) ids.push(piece.id);
    if (floor) ids.push(floor.id);

    return ids;
  }

  /**
   * Паспорт спрайта, который играет анимацию луча: предмет клетки (и под
   * накладкой - он виден сквозь неё), иначе подложка.
   */
  topUidAt(pos: IBoardCellPos): number {
    return this.cellAt(pos)?.uid ?? this.floors[pos.col][pos.row]?.uid ?? -1;
  }

  /** Самый частый цвет фишек на доске; ничья - по порядку цветов уровня. */
  mostCommonColor(): TMinigameChipId {
    const counts = new Map<string, number>();

    for (const piece of this.collectPieces(isChipPiece)) {
      counts.set(piece.id, (counts.get(piece.id) ?? 0) + 1);
    }

    return this.colors.reduce((best, color) =>
      (counts.get(color) ?? 0) > (counts.get(best) ?? 0) ? color : best
    );
  }

  rowCells(row: number): IBoardCellPos[] {
    return row < 0 || row >= this.rows
      ? []
      : Array.from({ length: this.cols }, (_, col) => ({ col, row }));
  }

  colCells(col: number): IBoardCellPos[] {
    return col < 0 || col >= this.cols
      ? []
      : Array.from({ length: this.rows }, (_, row) => ({ col, row }));
  }

  /** Клетка и четыре её соседа (в пределах поля). */
  crossCells(at: IBoardCellPos): IBoardCellPos[] {
    return [
      at,
      ...NEIGHBOR_OFFSETS.map((offset) => ({ col: at.col + offset.col, row: at.row + offset.row })),
    ].filter((pos) => this.isInside(pos));
  }

  positionsOf(pieces: readonly TBoardPiece[]): IBoardCellPos[] {
    const positions = this.positionsByUid();

    return pieces
      .map((piece) => positions.get(piece.uid))
      .filter((pos): pos is IBoardCellPos => pos !== undefined);
  }

  positionsByUid(): TPiecePositions {
    const positions = new Map<number, IBoardCellPos>();

    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        const piece = this.grid[col][row];

        if (piece) {
          positions.set(piece.uid, { col, row });
        }
      }
    }

    return positions;
  }

  collectPieces<TPiece extends TBoardPiece>(
    predicate: (piece: TBoardPiece) => piece is TPiece
  ): TPiece[];
  collectPieces(predicate: (piece: TBoardPiece) => boolean): TBoardPiece[];
  collectPieces(predicate: (piece: TBoardPiece) => boolean): TBoardPiece[] {
    const result: TBoardPiece[] = [];

    for (const column of this.grid) {
      for (const piece of column) {
        if (piece && predicate(piece)) {
          result.push(piece);
        }
      }
    }

    return result;
  }

  /** Свободные фишки для перемешки: под накладками фишки стоят. */
  collectChipSlots(): { piece: IChipPiece; cell: IReshuffleCell }[] {
    const slots: { piece: IChipPiece; cell: IReshuffleCell }[] = [];

    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows; row++) {
        const piece = this.grid[col][row];

        if (piece && isChipPiece(piece) && !this.overlays[col][row]) {
          slots.push({ piece, cell: { x: col, y: row } });
        }
      }
    }

    return slots;
  }

  /** Свободные фишки (без накладки) в случайном порядке - от зерна партии. */
  shuffledFreeChips(): IChipPiece[] {
    const chips = this.collectChipSlots().map((slot) => slot.piece);

    for (let index = chips.length - 1; index > 0; index--) {
      const swapWith = Math.floor(this.random() * (index + 1));

      [chips[index], chips[swapWith]] = [chips[swapWith], chips[index]];
    }

    return chips;
  }

  // ---------------------------------------------------------------- запись

  /** Раскладка «фишка -> клетка» поверх клеток фишек; блокеры и дыры не трогаются. */
  applyChipLayout(
    chips: readonly IChipPiece[],
    cells: readonly IReshuffleCell[],
    assignment: readonly number[]
  ): void {
    assignment.forEach((cellIndex, chipIndex) => {
      const cell = cells[cellIndex];

      this.grid[cell.x][cell.y] = chips[chipIndex];
    });
  }

  swapCells(first: IBoardCellPos, second: IBoardCellPos): void {
    const piece = this.grid[first.col][first.row];

    this.grid[first.col][first.row] = this.grid[second.col][second.row];
    this.grid[second.col][second.row] = piece;
  }

  pickColor(): TMinigameChipId {
    return this.colors[Math.floor(this.random() * this.colors.length)];
  }

  randomDirection(): TLaserDirection {
    return this.random() < 0.5 ? 'horizontal' : 'vertical';
  }

  createChip(color: TMinigameChipId): IChipPiece {
    return { uid: this.issueUid(), id: color, hp: BOARD_PIECE_HP.chip };
  }

  createSpecial(kind: TSpecialKind, direction: TLaserDirection): TSpecialPiece {
    const base = { uid: this.issueUid(), hp: BOARD_PIECE_HP.special };

    return kind === 'laser' ? { ...base, id: kind, direction } : { ...base, id: kind };
  }

  issueUid(): number {
    return this.nextUid++;
  }

  private buildLayer<T>(make: (col: number, row: number) => T | null): (T | null)[][] {
    return Array.from({ length: this.cols }, (_, col) =>
      Array.from({ length: this.rows }, (_, row) => make(col, row))
    );
  }
}
