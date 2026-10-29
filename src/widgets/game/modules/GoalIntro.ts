import { Graphics, Rectangle, type Container } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import { GOAL_INTRO_OVERLAY_DEPTH } from '../configs/sceneDepths';
import { GOAL_INTRO_TIMING } from '../configs/timing';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import { destroyDisplay, killDisplayTweens, tweenDisplay } from '../motion/displayMotion';

/** Затемнение интро на 80%: цель читается, а поле за ней нет. */
const OVERLAY_COLOR = SKIN.colors.fx.dim;
const OVERLAY_ALPHA = 0.8;

/**
 * Что интро знает о панели целей. Ровно три вопроса и одно уведомление - своей
 * копии геометрии панели у интро нет, иначе два места разъехались бы на первой
 * же правке отступа.
 */
export interface IGoalIntroTarget {
  /** Контейнер панели: интро укрупняет его, держит по центру и уводит в шапку. */
  readonly container: Container;
  /** Ширина панели в её обычном масштабе - от неё считается «половина экрана». */
  readonly getPanelWidth: () => number;
  /** Точка прилёта. Считает панель (`resolveFinalPosition`), а не интро. */
  readonly getFinalPosition: () => { x: number; y: number; scale: number };
  /** Интро доиграно - панель снова живёт по resize. Уход сцены сюда не приходит. */
  readonly onFinished: () => void;
}

/**
 * Интро цели уровня: затемнение на весь экран, укрупнённая панель по центру,
 * удержание и полёт в шапку - порт `GoalIntro` Phaser-эталона число в число.
 *
 * Фаз две: между ними `GameLogic` запускает сборку доски, чтобы мир
 * открывался **под** летящей целью.
 *
 * Прекратить интро досрочно можно двумя способами, и они не взаимозаменяемы:
 * - `isSkipped` - тап по затемнению: доиграть мгновенно;
 * - `isSceneGone` - модуль уничтожают вместе с партией: снять ожидание надо,
 *   доигрывать на обломках - нет. Часы рантайма к этому моменту уже погашены
 *   (`GameRuntimeCore.destroy`), и их промисы не резолвятся: без `release`
 *   фаза висела бы вечно.
 */
export class GoalIntro {
  private readonly core: GameRuntimeCore;
  private readonly target: IGoalIntroTarget;

  private overlay: Graphics | null = null;
  private release: (() => void) | null = null;
  private releasePromise: Promise<void> | null = null;
  private finalPosition: { x: number; y: number; scale: number } | null = null;

  private isSkipped = false;
  private isSceneGone = false;

  constructor(core: GameRuntimeCore, target: IGoalIntroTarget) {
    this.core = core;
    this.target = target;
  }

  /** Тап по затемнению: интро доигрывается досрочно. */
  private handleSkip = (): void => {
    if (this.isSkipped) {
      return;
    }

    this.isSkipped = true;
    this.release?.();
  };

  /** Фаза 1: затемнение, укрупнённая панель по центру, удержание. */
  public async playHold(): Promise<void> {
    const { motion, viewport } = this.core;
    const { width, height, layout } = viewport;
    const container = this.target.container;

    this.releasePromise = new Promise<void>((resolve) => {
      this.release = resolve;
    });

    // Сохраняем финальную позицию: её же берёт фаза 2 как точку прилёта.
    this.finalPosition = this.target.getFinalPosition();

    const overlay = new Graphics()
      .rect(0, 0, width, height)
      .fill({ color: OVERLAY_COLOR, alpha: OVERLAY_ALPHA });

    overlay.zIndex = GOAL_INTRO_OVERLAY_DEPTH;
    overlay.eventMode = 'static';
    overlay.cursor = 'pointer';
    overlay.hitArea = new Rectangle(0, 0, width, height);
    overlay.on('pointerdown', this.handleSkip);
    this.core.app.stage.addChild(overlay);
    this.overlay = overlay;

    // Укрупнённая цель стоит посреди безопасной зоны, а затемнение
    // закрывает весь канвас, включая отступы.
    container.position.set(width / 2, layout.centerY);

    const holdScale = width / 2 / this.target.getPanelWidth();

    container.scale.set(holdScale * GOAL_INTRO_TIMING.enterFromScale);
    await Promise.race([
      tweenDisplay(
        motion,
        container,
        { scale: holdScale },
        { duration: GOAL_INTRO_TIMING.enterMs, ease: 'Back.easeOut' }
      ),
      this.releasePromise,
    ]);

    if (this.isSceneGone) {
      return;
    }

    // Скип посреди входа не должен оставить панель на полпути.
    if (this.isSkipped) {
      killDisplayTweens(motion, container);
      container.scale.set(holdScale);
    }

    await Promise.race([motion.delay(GOAL_INTRO_TIMING.holdMs), this.releasePromise]);
  }

  /**
   * Фаза 2: полёт панели в шапку и снятие затемнения. Затемнение начинает
   * сниматься на `fadeStartRatio` полёта: мир открывается, пока цель едет.
   */
  public async playOutro(): Promise<void> {
    const overlay = this.overlay;
    const finalPosition = this.finalPosition;

    if (!overlay || !finalPosition || this.isSceneGone) {
      return;
    }

    const { motion } = this.core;
    const container = this.target.container;

    if (this.isSkipped) {
      await this.finishImmediately(overlay, finalPosition);

      return;
    }

    const flyTween = tweenDisplay(
      motion,
      container,
      { x: finalPosition.x, y: finalPosition.y, scale: finalPosition.scale },
      { duration: GOAL_INTRO_TIMING.flyMs, ease: 'Cubic.easeOut' }
    );

    // Скип, пришедший за время паузы, отменяет фейд: доигрывать его поверх
    // `finishImmediately` значило бы вести два твина одного `alpha`.
    const fadeTween = (async () => {
      await motion.delay(GOAL_INTRO_TIMING.flyMs * GOAL_INTRO_TIMING.fadeStartRatio);

      if (this.isSkipped || this.isSceneGone) {
        return;
      }

      await tweenDisplay(
        motion,
        overlay,
        { alpha: 0 },
        { duration: GOAL_INTRO_TIMING.fadeMs, ease: 'Cubic.easeOut' }
      );
    })();

    const outro = Promise.all([flyTween, fadeTween]);

    await (this.releasePromise ? Promise.race([outro, this.releasePromise]) : outro);

    if (this.isSceneGone) {
      return;
    }

    if (this.isSkipped) {
      killDisplayTweens(motion, container);
      killDisplayTweens(motion, overlay);
      await this.finishImmediately(overlay, finalPosition);

      return;
    }

    this.removeOverlay();
    this.target.onFinished();
  }

  private async finishImmediately(
    overlay: Graphics,
    { x, y, scale }: { x: number; y: number; scale: number }
  ): Promise<void> {
    const { motion } = this.core;
    const container = this.target.container;

    container.position.set(x, y);
    container.scale.set(scale);

    await tweenDisplay(
      motion,
      overlay,
      { alpha: 0 },
      { duration: GOAL_INTRO_TIMING.skipFadeMs, ease: 'Cubic.easeOut' }
    );
    await motion.delay(GOAL_INTRO_TIMING.skipSettleMs);

    if (this.isSceneGone) {
      return;
    }

    this.removeOverlay();
    this.target.onFinished();
  }

  private removeOverlay(): void {
    if (this.overlay && !this.overlay.destroyed) {
      this.overlay.off('pointerdown', this.handleSkip);
    }

    destroyDisplay(this.core.motion, this.overlay);
    this.overlay = null;
  }

  /**
   * Модуль целей уничтожают - интро отпускает своё ожидание (фаза выходит
   * через `isSceneGone`) и снимает затемнение.
   */
  public destroy(): void {
    this.isSceneGone = true;
    this.release?.();
    this.removeOverlay();
  }
}
