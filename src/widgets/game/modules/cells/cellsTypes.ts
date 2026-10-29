import type { TBoardPiece, TMinigameChipId } from '@/entities/game';
import type { GameRuntimeCore } from '../../core/GameRuntimeCore';
import type { IBoardFx } from '../../fx/boardFx';

/**
 * Коды клеток, которые рисует рантайм: совпадают с ключами текстур.
 *
 * Модель самой доски (прочность, направление лазера, фишка подо льдом) живёт
 * в движке - `TBoardPiece` из `entities/game`; здесь остаются только имена,
 * по которым спрайты выбирают текстуру и цвет частиц. Имена выводятся из
 * движка, а не перечисляются заново: новая фишка или спецфишка движка сразу
 * требует текстуру, и компилятор об этом напомнит.
 */
export type CellId = TBoardPiece['id'];

export type ChipColor = TMinigameChipId;

/**
 * Что клетке нужно от рантайма: ядро (часы и твины, текстуры, шина, сцена) и
 * эффекты доски. Передаётся явно - глобала ядра у Pixi-рантайма нет.
 */
export interface ICellRuntime {
  readonly core: GameRuntimeCore;
  readonly fx: IBoardFx;
}
