import type { ISceneLayout } from '../lib/sceneLayout';
import type { BoardEntity } from '../modules/cells/BoardEntity';
import type { TGameBoosterKind } from '../store/GameStore';

/** Видимая область сцены после ресайза: CSS px канваса и раскладка мира в них. */
export interface IRuntimeViewport {
  /** Ширина канваса, CSS px (координаты сцены при `autoDensity`). */
  width: number;
  /** Высота канваса, CSS px. */
  height: number;
  /** Раскладка мира в координатах сцены (`resolveSceneLayout`). */
  layout: ISceneLayout;
}

/** Свайп клетки: откуда и куда (`CellInputController` -> `GameLogic`). */
export interface ISwapRequest {
  row: number;
  col: number;
  targetRow: number;
  targetCol: number;
}

/** Палец ведёт клетку: ось, знак и сырой ход в дизайн-px (`SwapDragController`). */
export interface ISwapDragMove {
  row: number;
  col: number;
  dCol: number;
  dRow: number;
  offset: number;
}

/**
 * События рантайма партии - замена своих событий `scene.events` у
 * Phaser-эталона. Карта событий - тип: опечатка в имени или чужой payload не
 * компилируются, а у эталона они молча уходили в никуда.
 */
export interface IRuntimeEventMap {
  /** Канвас сменил размер, DPR или отступы: модули пересчитывают раскладку. */
  resize: IRuntimeViewport;
  /** Партия встала (проп `paused`): звук глушит музыку. */
  pause: undefined;
  /** Партия пошла дальше. */
  resume: undefined;

  // ------------------------------------------------- ввод доски (фаза 2)

  /** Жест закончился свайпом: ход заявлен (`GameLogic.handleSwapRequest`). */
  swapRequest: ISwapRequest;
  /** Жест не дотянул до порога - тап по клетке (выбор, второй тап, спецфишка). */
  cellTap: BoardEntity;
  /** Палец ведёт клетку: контроллер пары двигает обе половины. */
  swapDragMove: ISwapDragMove;
  /** Жест кончился без хода: `true` - пара уезжает плавно, `false` - встаёт сразу. */
  swapDragEnd: boolean;
  /** Жест перешёл в ход: смещение забывается, пару ведёт анимация свапа. */
  swapDragHandOff: undefined;

  // ------------------------------------------------------------ бустеры

  /** Кнопка бустера нажата: режим выбора цели включается или снимается. */
  boosterStart: TGameBoosterKind;
  /** Режим выбора цели снят - кнопки гасят выделение. */
  boosterEnd: undefined;
  /** Заряд бустера списан - кнопки перечитывают остаток. */
  boosterInventoryChanged: undefined;
  /** Палец над клеткой в бустер-режиме. */
  boosterCellOver: BoardEntity;
  boosterCellOut: BoardEntity;
  /** Клетка выбрана целью бустера. */
  boosterCellUp: BoardEntity;
}

type TListener<T> = (payload: T) => void;

/**
 * Типизированная шина событий рантайма.
 *
 * Своя, а не `EventEmitter` из `pixi.js`: шина - чистый модуль, её читают
 * тесты, а Pixi в jsdom не поднимается. Обработчик, бросивший исключение, не
 * должен ронять остальных подписчиков и того, кто эмитит (тикер, ресайз), -
 * поэтому каждый вызов изолирован, а сбой уходит в консоль с именем события.
 */
export class RuntimeEvents<TMap extends object = IRuntimeEventMap> {
  private readonly listeners = new Map<keyof TMap, Set<TListener<never>>>();

  /** Подписка; возвращает отписку. */
  on<K extends keyof TMap>(event: K, listener: TListener<TMap[K]>): () => void {
    let set = this.listeners.get(event);

    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }

    set.add(listener);

    return () => this.off(event, listener);
  }

  /** Подписка на одно срабатывание. */
  once<K extends keyof TMap>(event: K, listener: TListener<TMap[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });

    return off;
  }

  off<K extends keyof TMap>(event: K, listener: TListener<TMap[K]>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof TMap>(
    event: K,
    ...[payload]: TMap[K] extends undefined ? [] : [TMap[K]]
  ): void {
    const set = this.listeners.get(event);

    if (!set) {
      return;
    }

    // Копия: обработчик вправе отписаться (`once`) или подписать другого.
    [...set].forEach((listener) => {
      try {
        (listener as TListener<TMap[K]>)(payload as TMap[K]);
      } catch (error) {
        console.error(`[game] event "${String(event)}" listener failed`, error);
      }
    });
  }

  /** Снимает всех подписчиков - на уничтожении рантайма. */
  clear(): void {
    this.listeners.clear();
  }
}
