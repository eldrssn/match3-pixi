import type { Container } from 'pixi.js';
import type { RuntimeEvents } from '../core/RuntimeEvents';
import { runGuarded } from '../lib/runGuarded';
import type { RuntimeMotion } from '../motion/RuntimeMotion';
import type { TGameBoosterKind } from '../store/GameStore';
import type { BoardEntity } from './cells/BoardEntity';

/**
 * Задержка подписки на клик мимо доски: тап по кнопке бустера сам рождает
 * отпускание на сцене, и без паузы режим снимался бы тем же тапом, которым
 * его включили.
 */
const BACKGROUND_CANCEL_DELAY_MS = 300;

interface IBoosterModeOptions {
  events: RuntimeEvents;
  motion: RuntimeMotion;
  /** Корень сцены: отпускание мимо клеток снимает режим. */
  stage: Container;
  /** Доска занята каскадом: режим не переключается и цель не выбирается. */
  isBoardBusy: () => boolean;
  /** Спрайты доски - им включается и выключается режим цели. */
  getEntities: () => readonly BoardEntity[];
  /**
   * Игрок выбрал клетку-цель. Режим к этому моменту ещё включён: снимает его
   * владелец (`stop`), когда решит, тратить ли заряд.
   */
  onTargetPicked: (cell: BoardEntity) => void;
}

/**
 * Бустер-режим доски: кнопка бустера включает выбор цели (`boosterStart`),
 * тап по клетке отдаёт её владельцу, тап мимо доски или повторное нажатие
 * кнопки режим снимают.
 *
 * Сам бустер здесь не применяется: заряд, ход движка и проигрывание - у
 * `GameLogic`. Модуль владеет только подписками режима - событиями кнопок и
 * клеток, отпусканием на корне сцены и отложенным таймером этой подписки.
 */
export class BoosterMode {
  private readonly options: IBoosterModeOptions;
  private readonly unsubscribeStart: () => void;
  private unsubscribeTargets: (() => void)[] = [];

  /** Выбранный бустер; `null` - режим выключен. */
  private activeKind: TGameBoosterKind | null = null;
  private hoveredCell: BoardEntity | null = null;

  /**
   * Отложенная подписка на клик мимо доски. Держим ручку, чтобы отменить её
   * при досрочном выходе из режима: иначе обработчик навешивался уже после
   * `stop` и оставался жить до конца партии.
   */
  private cancelTimer: { kill: () => void } | null = null;
  private isBackgroundBound = false;

  constructor(options: IBoosterModeOptions) {
    this.options = options;
    this.unsubscribeStart = options.events.on('boosterStart', (kind) => {
      this.guard('boosterStart', () => this.toggle(kind));
    });
  }

  get isActive(): boolean {
    return this.activeKind !== null;
  }

  get kind(): TGameBoosterKind | null {
    return this.activeKind;
  }

  /** Выключает режим: клетки, подписки, подсветка; кнопки узнают по `boosterEnd`. */
  stop(): void {
    this.activeKind = null;

    for (const entity of this.options.getEntities()) {
      entity.disableBoosterMode();
    }

    // Отложенная подписка могла ещё не сработать - снимаем сам таймер.
    this.cancelTimer?.kill();
    this.cancelTimer = null;

    this.unsubscribeAllTargets();
    // Подсветку цели не гасим: клетка-цель светится, пока играет бустер, и
    // гасит её владелец после применения (`GameLogic.runBoosterTarget`).
    this.hoveredCell = null;

    this.options.events.emit('boosterEnd');
  }

  destroy(): void {
    this.unsubscribeStart();
    this.cancelTimer?.kill();
    this.cancelTimer = null;
    this.unsubscribeAllTargets();

    this.activeKind = null;
    this.hoveredCell = null;
  }

  /** Повторное нажатие на кнопку бустера снимает режим, а не включает его снова. */
  private toggle(kind: TGameBoosterKind): void {
    if (this.options.isBoardBusy()) {
      return;
    }

    if (this.isActive) {
      this.stop();
      return;
    }

    this.activeKind = kind;

    this.cancelTimer?.kill();
    this.cancelTimer = this.options.motion.schedule(BACKGROUND_CANCEL_DELAY_MS, () => {
      this.cancelTimer = null;
      this.options.stage.on('pointerup', this.handleBackgroundClick);
      this.isBackgroundBound = true;
    });

    for (const entity of this.options.getEntities()) {
      entity.enableBoosterMode();
    }

    const { events } = this.options;

    this.unsubscribeTargets = [
      events.on('boosterCellOver', this.handleCellOver),
      events.on('boosterCellOut', this.handleCellOut),
      events.on('boosterCellUp', this.handleCellUp),
    ];
  }

  private unsubscribeAllTargets(): void {
    this.unsubscribeTargets.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeTargets = [];

    if (this.isBackgroundBound && !this.options.stage.destroyed) {
      this.options.stage.off('pointerup', this.handleBackgroundClick);
    }

    this.isBackgroundBound = false;
  }

  /**
   * Отпускание мимо клеток. Отпускание над клеткой-целью сюда не доходит:
   * клетка гасит всплытие (`CellInputController.onBoosterUp`).
   */
  private handleBackgroundClick = (): void => {
    this.guard('boosterBackgroundClick', () => {
      if (this.options.isBoardBusy() || !this.isActive) {
        return;
      }

      this.stop();
    });
  };

  private handleCellOver = (cell: BoardEntity): void => {
    // Подсвечена другая клетка - гасим её.
    if (this.hoveredCell && this.hoveredCell !== cell) {
      this.hoveredCell.unbrightCell();
    }

    this.hoveredCell = cell;
    this.hoveredCell.brightCell();
  };

  private handleCellOut = (cell: BoardEntity): void => {
    // Сбрасываем только если это та же клетка.
    if (this.hoveredCell === cell) {
      this.hoveredCell.unbrightCell();
      this.hoveredCell = null;
    }
  };

  private handleCellUp = (cell: BoardEntity): void => {
    if (this.options.isBoardBusy()) {
      return;
    }

    // Обычно бустер применяется к клетке, на которую навели (`boosterCellOver`).
    // Но тап по тачу не всегда рождает `pointerover`, и подсветки нет. Тогда
    // целимся прямо в клетку отпускания. Навели на одну, а отпустили на
    // другой - это по-прежнему промах (ничего не делаем).
    const target = this.hoveredCell ?? cell;

    if (target === cell) {
      this.options.onTargetPicked(cell);
    }
  };

  /**
   * Обработчики режима синхронные, но зовутся из шины и указателя Pixi:
   * `runGuarded` логирует сбой с именем сценария.
   */
  private guard(scope: string, run: () => void): void {
    runGuarded(scope, () => {
      run();

      return Promise.resolve();
    });
  }
}
