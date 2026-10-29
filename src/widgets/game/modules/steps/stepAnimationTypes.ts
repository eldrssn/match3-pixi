import type { Container } from 'pixi.js';
import type { IBoardCellPos, TBoardPiece } from '@/entities/game';
import type { SoundEngine } from '../../audio/SoundEngine';
import type { GameRuntimeCore } from '../../core/GameRuntimeCore';
import type { IBoardFx } from '../../fx/boardFx';
import type { IBoardHud } from '../../hud/boardHud';
import type { TBoardStepOf, TBoardStepType } from '../../model/boardStepTypes';
import type { CascadeAccents } from '../CascadeAccents';
import type { BoardEntity } from '../cells/BoardEntity';
import type { LayerEntity } from '../cells/LayerEntity';

export type { TBoardStepOf, TBoardStepType };

/**
 * Зеркало доски спрайтами, которое видит анимация шага: спрайты по паспортам
 * движка и грид клеток. Анимация обязана держать грид в такт движку - кто
 * ушёл с доски, кто куда встал; дальше это проверяет `assertInSync` в dev.
 */
export interface IStepBoard {
  /** Спрайт фишки движка по паспорту (`TBoardPiece.uid`). */
  entity(uid: number): BoardEntity | undefined;
  cellAt(col: number, row: number): BoardEntity | null;
  /** Спрайт накладки или подложки по паспорту. */
  layer(uid: number): LayerEntity | undefined;
  /** Слой разрушен: паспорт забывается. */
  forgetLayer(uid: number): void;
  /** Новый спрайт фишки движка, сразу в своей клетке грида. */
  spawn(piece: Readonly<TBoardPiece>, col: number, row: number): BoardEntity;
  /**
   * Сущность уходит с доски: клетка грида освобождается, паспорт забывается,
   * владелец снимает свои ссылки. Один путь на все способы ухода.
   */
  detach(uid: number): BoardEntity | undefined;
  /** Ставит спрайт в клетку грида и переписывает его координаты. */
  place(entity: BoardEntity, col: number, row: number): void;
  /** Освобождает клетку `at` (по умолчанию - свою), если сущность ещё в ней. */
  vacate(entity: BoardEntity, at?: IBoardCellPos): void;
}

/** Всё, что получает анимация шага. */
export interface IStepAnimationContext {
  /** Ядро партии: часы и твины (`core.motion`), шина, текстуры. */
  core: GameRuntimeCore;
  /** Контейнер доски: эффекты ложатся поверх её слоёв. */
  container: Container;
  /** Эффекты доски (`IBoardFx`): лучи, волны, частицы, тряска. */
  fx: IBoardFx;
  /** Шапка партии: счётчик ходов (бонус финала). */
  hud: IBoardHud;
  colCount: number;
  rowCount: number;
  /** Звук партии; `null` - проигрывание идёт молча. */
  sound: SoundEngine | null;
  /** Попап «×N» и акценты звена каскада. */
  accents: CascadeAccents;
  board: IStepBoard;
  /** Партия выключена: длинная анимация обрывается, а не трогает мёртвые спрайты. */
  isDestroyed(): boolean;
}

/**
 * Анимация шага. Ожидается целиком: следующий шаг не начнётся раньше, чем
 * резолвится эта (урон по линии - после выстрела, падение - после барьера).
 * Синхронная (`void`) не задерживает протокол ни на кадр.
 */
export type TStepAnimation<T extends TBoardStepType = TBoardStepType> = (
  context: IStepAnimationContext,
  step: TBoardStepOf<T>
) => Promise<void> | void;

/** Анимации на все виды шагов: шаг без анимации - ошибка компиляции. */
export type TStepAnimations = { readonly [T in TBoardStepType]: TStepAnimation<T> };

/**
 * Переопределение анимации шага в копии проекта. `playDefault` - анимация по
 * умолчанию: позвать её и добавить своё, дождаться и доиграть после, или не
 * звать вовсе и заменить целиком (тогда грид держит в такт движку сама
 * анимация - см. `IStepBoard`).
 */
export type TStepAnimationOverride<T extends TBoardStepType = TBoardStepType> = (
  context: IStepAnimationContext,
  step: TBoardStepOf<T>,
  playDefault: () => Promise<void>
) => Promise<void> | void;

export type TStepAnimationOverrides = {
  readonly [T in TBoardStepType]?: TStepAnimationOverride<T>;
};
