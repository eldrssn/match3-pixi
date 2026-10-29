import type { Container } from 'pixi.js';
import type { RuntimeMotion } from '../motion/RuntimeMotion';
import type { BoardEntity } from './cells/BoardEntity';

/** Сколько доска молчит, прежде чем подсказать ход. */
const IDLE_HINT_DELAY_MS = 5000;

/**
 * Подсказка простоя: если игрок долго не делает ход, мягко пульсирует пара
 * фишек с валидным свапом.
 *
 * Это не подсветка спецфишки в тупике - это лёгкий пульс на самих фишках для
 * игрока, который засмотрелся на доску с доступными ходами.
 *
 * Пары ищет колбэк владельца (`GameLogic`): там живёт грид и все гейты -
 * занятость доски и исход партии (`lib/canShowIdleHint`). Модуль отвечает
 * только за таймер на часах рантайма; сам пульс играет клетка
 * (`BoardEntity.playIdlePulse`), потому что масштабом спрайта владеет она.
 */
export class IdleHint {
  private readonly motion: RuntimeMotion;
  private readonly stage: Container;
  private readonly resolvePair: () => BoardEntity[] | null;

  private timer: { kill: () => void } | null = null;
  private pulsingChips: BoardEntity[] = [];

  constructor(motion: RuntimeMotion, stage: Container, resolvePair: () => BoardEntity[] | null) {
    this.motion = motion;
    this.stage = stage;
    this.resolvePair = resolvePair;

    // Любой тап в сцене сдвигает подсказку: игрок ещё думает.
    stage.on('pointerdown', this.handlePointerDown);
  }

  /**
   * (Пере)запускает отсчёт до подсказки. Вызывается на каждом освобождении
   * доски и на каждом тапе; идемпотентен, пульс не трогает.
   */
  arm(): void {
    if (this.pulsingChips.length > 0) {
      return;
    }

    this.timer?.kill();
    this.timer = this.motion.schedule(IDLE_HINT_DELAY_MS, () => {
      this.timer = null;
      this.fire();
    });
  }

  /** Гасит и таймер, и пульс: на время каскада и при разборке модуля. */
  disarm(): void {
    this.timer?.kill();
    this.timer = null;
    this.stopPulse();
  }

  destroy(): void {
    if (!this.stage.destroyed) {
      this.stage.off('pointerdown', this.handlePointerDown);
    }

    this.disarm();
  }

  private handlePointerDown = (): void => {
    this.stopPulse();
    this.arm();
  };

  /**
   * Отсчёт вышел. Пары может не быть - тогда ждать дальше нечего, и отсчёт
   * не перезапускается: на закрытом гейте состояние само не изменится, а
   * новый отсчёт придёт с ближайшим освобождением доски или тапом игрока.
   */
  private fire(): void {
    const chips = this.resolvePair();

    if (!chips || chips.length === 0) {
      return;
    }

    for (const chip of chips) {
      chip.playIdlePulse();
      this.pulsingChips.push(chip);
    }
  }

  /** Снимает пульс. Гасит его сама клетка: она вернёт базовый масштаб. */
  private stopPulse(): void {
    for (const chip of this.pulsingChips) {
      chip.stopIdlePulse();
    }
    this.pulsingChips = [];
  }
}
