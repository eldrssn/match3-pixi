import { isMinigameChipId, type TBoardPiece, type TMinigameChipId } from '@/entities/game';
import type { BoardEntity, IBoardEntityPlace } from './BoardEntity';
import { BombEntity } from './BombEntity';
import { CargoEntity } from './CargoEntity';
import { ChipEntity } from './ChipEntity';
import { DropEntity } from './DropEntity';
import { HoleEntity } from './HoleEntity';
import { LaserEntity } from './LaserEntity';
import { PropellerEntity } from './PropellerEntity';
import { RainbowEntity } from './RainbowEntity';
import { SlimeEntity } from './SlimeEntity';
import { StoneEntity } from './StoneEntity';

/**
 * Ключ вида: код элемента движка, только все цвета фишек - один вид `chip`.
 * Новый цвет фишки вида не требует, новый элемент движка - требует.
 */
export type TBoardViewKey = Exclude<TBoardPiece['id'], TMinigameChipId> | 'chip';

type TPieceOf<K extends TBoardViewKey> = K extends 'chip'
  ? Extract<TBoardPiece, { id: TMinigameChipId }>
  : Extract<TBoardPiece, { id: K }>;

/** Фабрика вида: сущность под фишку движка (ещё не нарисованная). */
export type TBoardViewFactory<P extends TBoardPiece = TBoardPiece> = (
  piece: Readonly<P>,
  place: IBoardEntityPlace
) => BoardEntity;

/**
 * Реестр видов доски - половина описания элемента, которая живёт в рантайме:
 * классы Pixi не могут лежать в `entities/skin`, поэтому вид выбирается
 * здесь, по тому же коду, а как он выглядит (текстуры, частицы, звук удара),
 * класс читает из скина.
 *
 * Тип - запись по всем кодам движка: элемент, заведённый в `TBoardPiece` без
 * вида, не скомпилируется. Блокеру без своего поведения хватит существующего
 * класса (как `StoneEntity`) - строка здесь и запись в скине.
 */
export const BOARD_VIEWS: { readonly [K in TBoardViewKey]: TBoardViewFactory<TPieceOf<K>> } = {
  chip: (piece, place) => new ChipEntity(piece.id, piece.hp, place),
  laser: (piece, place) => new LaserEntity(piece.id, piece.hp, piece.direction, place),
  propeller: (piece, place) => new PropellerEntity(piece.id, piece.hp, place),
  bomb: (piece, place) => new BombEntity(piece.id, piece.hp, place),
  rainbow: (piece, place) => new RainbowEntity(piece.id, piece.hp, place),
  cargo: (piece, place) => new CargoEntity(piece.id, piece.hp, place),
  stone: (piece, place) => new StoneEntity(piece.id, piece.hp, place),
  slime: (piece, place) => new SlimeEntity(piece.id, piece.hp, place),
  drop: (piece, place) => new DropEntity(piece.id, piece.hp, place),
  HOLE: (piece, place) => new HoleEntity(piece.id, piece.hp, place),
};

export const resolveBoardViewKey = (id: TBoardPiece['id']): TBoardViewKey =>
  isMinigameChipId(id) ? 'chip' : id;
