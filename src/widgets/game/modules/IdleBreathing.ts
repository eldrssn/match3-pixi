import { pickBreathDelayMs } from '../lib/hudRules';
import type { IMotionTween, RuntimeMotion } from '../motion/RuntimeMotion';
import type { ChipEntity } from './cells/ChipEntity';
import type { TCellDisplay } from './cells/views/cellView';

/** Минимальная пауза между вдохами. */
const BREATH_MIN_DELAY_MS = 4000;

/** Максимальная пауза между вдохами. */
const BREATH_MAX_DELAY_MS = 6000;

/** Насколько фишка приглушается в нижней точке дыхания. */
const BREATH_MIN_ALPHA = 0.82;

/** Полный цикл дыхания (вниз и обратно). */
const BREATH_DURATION_MS = 2200;

/**
 * Дыхание фишек в покое: раз в несколько секунд случайная фишка едва заметно
 * приглушается и возвращается - порт `IdleBreathing` Phaser-эталона.
 *
 * Живёт в паре с `IdleHint` на одном жизненном цикле: arm на освобождении
 * доски, disarm на занятии. Целевое свойство - **alpha**, сознательно не
 * scale: масштабом фишки владеют вид клетки и пульс подсказки простоя.
 * Пауза между вдохами - косметика, поэтому `Math.random`, а не зерно партии.
 */
export class IdleBreathing {
  private readonly motion: RuntimeMotion;
  private readonly pickChip: () => ChipEntity | null;

  private isArmed = false;
  private timer: { kill: () => void } | null = null;
  private breathTween: IMotionTween | null = null;
  private breathImage: TCellDisplay | null = null;

  constructor(motion: RuntimeMotion, pickChip: () => ChipEntity | null) {
    this.motion = motion;
    this.pickChip = pickChip;
  }

  /** Запускает ambient-цикл. Идемпотентен. */
  arm(): void {
    if (this.isArmed) {
      return;
    }

    this.isArmed = true;
    this.scheduleNextBreath();
  }

  /** Останавливает цикл и гасит текущее дыхание. */
  disarm(): void {
    this.isArmed = false;
    this.timer?.kill();
    this.timer = null;
    this.stopBreath();
  }

  destroy(): void {
    this.disarm();
  }

  private scheduleNextBreath(): void {
    if (!this.isArmed) {
      return;
    }

    this.timer?.kill();
    this.timer = this.motion.schedule(
      pickBreathDelayMs(BREATH_MIN_DELAY_MS, BREATH_MAX_DELAY_MS, Math.random),
      () => {
        this.timer = null;
        this.playBreath();
      }
    );
  }

  /**
   * Отсчёт вышел. Фишки нет (гейт закрыт или фишек не осталось) - отсчёт не
   * перезапускаем: новый придёт с ближайшим освобождением доски.
   */
  private playBreath(): void {
    if (!this.isArmed) {
      return;
    }

    const image = this.pickChip()?.image;

    if (!image || image.destroyed) {
      this.isArmed = false;

      return;
    }

    this.breathImage = image;
    image.alpha = 1;
    // Часы рантайма напрямую: `onComplete` - только на честном конце вдоха,
    // а не на остановке (`disarm`).
    this.breathTween = this.motion.add(
      image,
      { alpha: BREATH_MIN_ALPHA },
      {
        duration: BREATH_DURATION_MS / 2,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.breathTween = null;
          this.breathImage = null;
          this.scheduleNextBreath();
        },
      }
    );
  }

  /**
   * Гасит текущее дыхание, снимая ровно свой твин, и возвращает alpha - иначе
   * прерванная каскадом фишка осталась бы полупрозрачной навсегда.
   */
  private stopBreath(): void {
    this.breathTween?.kill();
    this.breathTween = null;

    if (this.breathImage && !this.breathImage.destroyed) {
      this.breathImage.alpha = 1;
    }

    this.breathImage = null;
  }
}
