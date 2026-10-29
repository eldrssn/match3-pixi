import {
  isMinigameChipId,
  isMinigameOverlayId,
  isMinigameSpecialId,
  MINIGAME_LAYER_LIMITS,
  type TMinigameChipId,
  type TMinigameOverlayId,
} from '../lib/minigameLevelConfig';
import type { IMinigameLevelCell } from '../types';

/**
 * Фишки, блокеры и слои доски в том виде, в котором их видит движок.
 *
 * `id` - тот же код, что в уровне и у спрайтов рантайма (`red`, `cargo`,
 * `ice`, ...): по нему чистые правила сравнивают цвета в линии, по нему же
 * считается шаг цели уровня. `uid` - паспорт конкретного объекта на всю
 * партию: по нему рантайм находит спрайт, который надо уронить, взорвать или
 * сдвинуть, не сверяясь с координатами, - координаты к моменту анимации могут
 * быть уже другими.
 *
 * Клетка доски - три слоя: предмет (`TBoardPiece`), накладка поверх фишки
 * (`IOverlayPiece`) и подложка под клеткой (`IFloorPiece`).
 */

export type TLaserDirection = 'horizontal' | 'vertical';

interface IBoardPieceBase {
  uid: number;
  /** Сколько ударов объект ещё выдержит. */
  hp: number;
}

export interface IChipPiece extends IBoardPieceBase {
  id: TMinigameChipId;
}

/** Лазер (ракета): чистит строку или колонку, рождается из линии 4. */
export interface ILaserPiece extends IBoardPieceBase {
  id: 'laser';
  direction: TLaserDirection;
}

/** Пропеллер: крест вокруг себя и полёт в приоритетную цель, рождается из квадрата 2×2. */
export interface IPropellerPiece extends IBoardPieceBase {
  id: 'propeller';
}

/** Бомба: квадрат 3×3 вокруг себя, рождается из фигуры L/T. */
export interface IBombPiece extends IBoardPieceBase {
  id: 'bomb';
}

/** Радуга: все фишки одного цвета, рождается из линии 5+. */
export interface IRainbowPiece extends IBoardPieceBase {
  id: 'rainbow';
}

/** Спецфишка - награда за фигуру; срабатывает свапом, тапом или под чужим эффектом. */
export type TSpecialPiece = ILaserPiece | IPropellerPiece | IBombPiece | IRainbowPiece;

export type TSpecialKind = TSpecialPiece['id'];

/** Ящик: неподвижный блокер в 1-3 слоя, снимается ударом рядом и прямым ударом. */
export interface ICargoPiece extends IBoardPieceBase {
  id: 'cargo';
}

/** Камень: неподвижный блокер, которого берут только спецфишки и бустеры. */
export interface IStonePiece extends IBoardPieceBase {
  id: 'stone';
}

/**
 * Слизь: неподвижный блокер, который снимается ударом рядом и прямым ударом,
 * а после хода, в котором её не тронули, расползается на соседнюю фишку.
 */
export interface ISlimePiece extends IBoardPieceBase {
  id: 'slime';
}

/**
 * «Опусти вниз»: падает и свапается, как фишка, но не матчится и урона не
 * получает. Дошёл до дна колонки - собран.
 */
export interface IDropPiece extends IBoardPieceBase {
  id: 'drop';
}

/** Дыра: клетки нет вовсе - ни урона, ни падения, ни добора. */
export interface IHolePiece extends IBoardPieceBase {
  id: 'HOLE';
}

export type TBoardPiece =
  IChipPiece | TSpecialPiece | ICargoPiece | IStonePiece | ISlimePiece | IDropPiece | IHolePiece;

/**
 * Накладка поверх фишки. Держит фишку на месте (её не свапнуть и не уронить)
 * и принимает удары на себя, пока не разбита. Лёд вдобавок не пускает фишку в
 * линию и снимается ударом рядом; цепь фишку в линию пускает и снимается
 * только прямым ударом - в том числе матчем самой фишки.
 */
export interface IOverlayPiece extends IBoardPieceBase {
  id: TMinigameOverlayId;
}

/** Подложка: снимается слоем за удар, когда на её клетке гаснет предмет. */
export interface IFloorPiece extends IBoardPieceBase {
  id: 'floor';
}

/** Слой клетки, по которому пришёлся удар. */
export type TBoardLayer = 'piece' | 'overlay' | 'floor';

type TDistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Объект без паспорта: паспорт выдаёт движок, когда кладёт его на доску. */
export type TBoardPieceSeed = TDistributiveOmit<TBoardPiece, 'uid'>;

/** Клетка без паспортов: предмет (или пусто), накладка и подложка. */
export interface IBoardCellSeed {
  piece: TBoardPieceSeed | null;
  overlay?: Omit<IOverlayPiece, 'uid'> | null;
  floor?: Omit<IFloorPiece, 'uid'> | null;
}

/** Прочность на старте. Ящик и подложка берут свою из уровня (`layers`, `floor`). */
export const BOARD_PIECE_HP = {
  chip: 1,
  special: 1,
  stone: 1,
  slime: 1,
  drop: 1,
  hole: 1,
} as const;

export const BOARD_OVERLAY_HP: Record<TMinigameOverlayId, number> = {
  ice: 2,
  chain: 1,
};

export const isChipPiece = (piece: TBoardPiece): piece is IChipPiece => isMinigameChipId(piece.id);

export const isLaserPiece = (piece: TBoardPiece): piece is ILaserPiece => piece.id === 'laser';

const SPECIAL_KINDS: ReadonlySet<string> = new Set<TSpecialKind>([
  'laser',
  'propeller',
  'bomb',
  'rainbow',
]);

export const isSpecialPiece = (piece: TBoardPiece): piece is TSpecialPiece =>
  SPECIAL_KINDS.has(piece.id);

export const isHolePiece = (piece: TBoardPiece): piece is IHolePiece => piece.id === 'HOLE';

export const isDropPiece = (piece: TBoardPiece): piece is IDropPiece => piece.id === 'drop';

export const isSlimePiece = (piece: TBoardPiece): piece is ISlimePiece => piece.id === 'slime';

/** Неподвижный блокер-предмет: сквозь него не падают, на его место ничего не встаёт. */
export const isStaticPiece = (
  piece: TBoardPiece
): piece is ICargoPiece | IStonePiece | ISlimePiece =>
  piece.id === 'cargo' || piece.id === 'stone' || piece.id === 'slime';

/** Двигать свапом можно фишку, спецфишку и «опусти вниз»; блокеры и дыра стоят. */
export const canSwapPiece = (piece: TBoardPiece): boolean =>
  isChipPiece(piece) || isSpecialPiece(piece) || isDropPiece(piece);

const pieceFromId = (cell: IMinigameLevelCell): TBoardPieceSeed => {
  if (isMinigameChipId(cell.id)) {
    return { id: cell.id, hp: BOARD_PIECE_HP.chip };
  }

  if (isMinigameSpecialId(cell.id)) {
    return cell.id === 'laser'
      ? { id: 'laser', hp: BOARD_PIECE_HP.special, direction: cell.direction ?? 'horizontal' }
      : { id: cell.id, hp: BOARD_PIECE_HP.special };
  }

  switch (cell.id) {
    case 'cargo':
      return { id: 'cargo', hp: cell.layers ?? MINIGAME_LAYER_LIMITS.cargo.fallback };

    case 'stone':
      return { id: 'stone', hp: BOARD_PIECE_HP.stone };

    case 'slime':
      return { id: 'slime', hp: BOARD_PIECE_HP.slime };

    case 'drop':
      return { id: 'drop', hp: BOARD_PIECE_HP.drop };

    case 'HOLE':
      return { id: 'HOLE', hp: BOARD_PIECE_HP.hole };

    default:
      throw new Error(`Unknown cell id: ${cell.id}`);
  }
};

/**
 * Клетка уровня (формат v2) -> клетка движка.
 *
 * Бросает на неизвестном предмете или накладке: уровень с такой клеткой
 * доиграть нельзя, и молча подменить её
 * значило бы показать игроку другую доску. Рантайм ловит это как отказ
 * старта партии.
 */
export const createCellFromLevel = (cell: IMinigameLevelCell): IBoardCellSeed => {
  const seed: IBoardCellSeed = { piece: pieceFromId(cell) };

  if (cell.overlay !== undefined) {
    if (!isMinigameOverlayId(cell.overlay) || !isMinigameChipId(cell.id)) {
      throw new Error(`Overlay ${cell.overlay} cannot lie on ${cell.id}`);
    }

    seed.overlay = { id: cell.overlay, hp: BOARD_OVERLAY_HP[cell.overlay] };
  }

  if (cell.floor !== undefined && cell.floor > 0 && cell.id !== 'HOLE') {
    seed.floor = { id: 'floor', hp: cell.floor };
  }

  return seed;
};
