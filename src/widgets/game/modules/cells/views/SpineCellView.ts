import type { Container } from 'pixi.js';
import { resolveSpineIdle, SKIN, skinTextureWidth, type ISkinSpineView } from '@/entities/skin';
import { BOARD_TIMING } from '../../../configs/timing';
import { resolveDestroyTint } from '../../../lib/destroyTint';
import {
  addDisplayTween,
  killDisplayTweens,
  tweenDisplay,
  type IDisplayTweenProps,
} from '../../../motion/displayMotion';
import type { IMotionTween, ITweenOptions, RuntimeMotion } from '../../../motion/RuntimeMotion';
import type { ISpineActor } from '../../../spine/spineSupport';
import { collapseMotion } from './cellMotions';
import type {
  ICellDestroyContext,
  ICellFallScale,
  ICellLook,
  ICellView,
  ICellViewPlace,
} from './cellView';
import {
  APPEAR_MS,
  HIGHLIGHT_MIN_ALPHA,
  HIGHLIGHT_PULSE_MS,
  IDLE_PULSE_SCALE,
  LAND_SQUASH_SCALE_X,
  LAND_SQUASH_SCALE_Y,
  NO_TINT,
  PRESS_SCALE,
  resolveFallStretch,
} from './SpriteCellView';

/**
 * Вид клетки `spine`: скелет Spine (`ISkinSpineView`) вместо спрайта.
 *
 * Анимации скелета - на крючках вида: покой (по стадии прочности), появление,
 * удар, разрушение. Остальное - те же твины, что у `SpriteCellView`
 * (нажатие, приземление, пульс подсказки, подсветка, тинт, падение): у
 * сущности доски нет второго набора правил под Spine, ей нужен только
 * `Container`.
 *
 * Время скелета - часы рантайма с темпом (`RuntimeMotion.onFrame`, `follow`):
 * пауза партии останавливает скелет, ускорение доски ускоряет его вровень с
 * твинами. Сам `@esotericsoftware/spine-pixi-v8` здесь не импортируется:
 * скелет создаёт загруженная поддержка (`core.spine`, ленивый чанк `spine`).
 *
 * Украшения покоя текстуры (`ICellLook.decorate`: поворот ракеты, вращение
 * радуги) скелету не нужны - он анимирует себя сам.
 */
export class SpineCellView implements ICellView {
  private readonly place: ICellViewPlace;
  private readonly look: ICellLook;
  private readonly spec: ISkinSpineView;
  private readonly motion: RuntimeMotion;
  private readonly container: Container;
  private actor: ISpineActor | null = null;
  private offFrame: (() => void) | null = null;
  private hp = 1;
  private scaleTween: IMotionTween | null = null;
  private pulseTween: IMotionTween | null = null;
  private highlightTween: IMotionTween | null = null;
  private isHighlighted = false;
  private overlayTint: number | null = null;
  /** Номер текущего разового прохода: покой после него ставит только последний. */
  private playId = 0;

  constructor(place: ICellViewPlace, look: ICellLook, spec: ISkinSpineView) {
    this.place = place;
    this.look = look;
    this.spec = spec;
    this.motion = place.runtime.core.motion;
    this.container = place.container;
  }

  get display(): Container | null {
    return this.actor?.display ?? null;
  }

  /**
   * Масштаб скелета: та же ширина на доске, что у текстуры покоя элемента
   * (`look.baseScale × ширина текстуры`), делённая на ширину скелета в его
   * единицах (`spec.width`).
   */
  get baseScale(): number {
    return (this.look.baseScale * skinTextureWidth(this.look.texture(1))) / this.spec.width;
  }

  get restTexture(): string {
    return this.look.texture(this.hp);
  }

  create(x: number, y: number, hp: number): void {
    this.dispose();
    this.hp = hp;

    const support = this.place.runtime.core.spine;

    if (!support) {
      throw new Error(`[game] вид клетки spine у «${this.place.id}» без загруженного Spine`);
    }

    const actor = support.createActor(this.spec);
    const { display } = actor;

    display.position.set(x, y);
    display.scale.set(this.baseScale);
    display.alpha = 0;
    this.container.addChild(display);
    this.actor = actor;
    this.offFrame = this.motion.onFrame((deltaMs) => actor.update(deltaMs));
    this.applyTint();
    this.idle();
  }

  dispose(): void {
    this.stopMotion();
    this.highlightTween?.kill();
    this.highlightTween = null;
    this.isHighlighted = false;
    this.overlayTint = null;
    this.pulseTween = null;
    this.offFrame?.();
    this.offFrame = null;

    const actor = this.actor;

    if (actor) {
      // Твины пишут в объект каждый кадр: сначала они, потом скелет.
      killDisplayTweens(this.motion, actor.display);
      actor.destroy();
    }

    this.actor = null;
  }

  async appear(): Promise<void> {
    const display = this.display;

    if (!display) return;

    display.scale.set(0);
    display.alpha = 1;

    const { appear } = this.spec.animations;

    if (appear) {
      this.playThenIdle(appear);
    }

    await tweenDisplay(
      this.motion,
      display,
      { scale: this.baseScale },
      { duration: APPEAR_MS, ease: 'Back.easeOut' }
    );
  }

  spawn(): void {
    const display = this.display;

    if (!display) return;

    display.scale.set(0);
    display.alpha = 1;
    this.playScaleTween(
      { scale: this.baseScale },
      { duration: BOARD_TIMING.special.spawnMs, ease: 'Back.easeOut' }
    );
  }

  /** Покой своей стадии по кругу; без анимации покоя скелет стоит в позе. */
  idle(): void {
    const name = resolveSpineIdle(this.spec, this.hp);

    if (name && this.actor) {
      this.playId += 1;
      void this.actor.play(name, true);
    }
  }

  press(): void {
    this.playScaleTween(
      { scale: this.baseScale * PRESS_SCALE },
      { duration: BOARD_TIMING.input.pressMs, ease: 'Sine.easeOut' }
    );
  }

  release(): void {
    this.stopMotion();
    this.display?.scale.set(this.baseScale);
    this.bright(false);
  }

  pulse(isOn: boolean): void {
    const display = this.display;

    if (isOn) {
      if (!display) return;

      this.playScaleTween(
        { scale: this.baseScale * IDLE_PULSE_SCALE },
        { duration: BOARD_TIMING.idle.pulseMs, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }
      );
      this.pulseTween = this.scaleTween;

      return;
    }

    if (this.pulseTween && this.pulseTween === this.scaleTween) {
      this.stopMotion();
      display?.scale.set(this.baseScale);
    }

    this.pulseTween = null;
  }

  bright(isOn: boolean): void {
    const display = this.display;

    if (!display) return;

    if (isOn) {
      display.blendMode = 'add';
      display.tint = SKIN.colors.fx.cellBright;

      return;
    }

    display.blendMode = 'normal';
    this.applyTint();
  }

  highlight(isOn: boolean): void {
    const display = this.display;

    if (isOn) {
      if (this.isHighlighted || !display) return;

      this.isHighlighted = true;
      this.overlayTint = SKIN.colors.fx.specialHint;
      this.applyTint();
      display.alpha = HIGHLIGHT_MIN_ALPHA;
      this.highlightTween = addDisplayTween(
        this.motion,
        display,
        { alpha: 1 },
        { duration: HIGHLIGHT_PULSE_MS, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }
      );

      return;
    }

    if (!this.isHighlighted) return;

    this.isHighlighted = false;
    this.highlightTween?.kill();
    this.highlightTween = null;
    this.overlayTint = null;

    if (!display) return;

    this.applyTint();
    display.alpha = 1;
  }

  tint(color: number | null): void {
    this.overlayTint = color;
    this.applyTint();
  }

  /** Удар: проход `hit` (если есть), затем покой новой стадии. */
  hit(hpLeft: number): void {
    this.hp = hpLeft;

    if (!this.actor || hpLeft <= 0) return;

    this.applyTint();

    const { hit } = this.spec.animations;

    if (hit) {
      this.playThenIdle(hit);
    } else {
      this.idle();
    }
  }

  /**
   * Проход `destroy` заменяет схлопывание: частицы - на его старте, скелет
   * снимается по концу прохода. Без анимации - схлопывание твином, как у
   * спрайта (или своё разрушение элемента, `ICellLook.destroy`).
   */
  destroy(): Promise<void> | void {
    const display = this.display;

    if (!display) return;

    this.stopMotion();

    const { destroy } = this.spec.animations;
    const context = this.destroyContext(display);

    if (!destroy) {
      return (this.look.destroy ?? collapseMotion)(context);
    }

    context.burst();

    return this.playOnce(destroy);
  }

  async vanish(): Promise<void> {
    this.stopMotion();

    await tweenDisplay(
      this.motion,
      this.display,
      { scale: 0, alpha: 0 },
      { duration: BOARD_TIMING.destroy.anticipationMs * 2, ease: 'Quad.easeIn' }
    );
  }

  fallScale(rows: number): ICellFallScale {
    const stretch = resolveFallStretch(rows);

    return { scaleX: this.baseScale / stretch, scaleY: this.baseScale * stretch };
  }

  land(): void {
    const display = this.display;

    if (!display) return;

    display.scale.set(this.baseScale * LAND_SQUASH_SCALE_X, this.baseScale * LAND_SQUASH_SCALE_Y);
    this.playScaleTween(
      { scaleX: this.baseScale, scaleY: this.baseScale },
      { duration: BOARD_TIMING.fall.landSquashMs, ease: 'Back.easeOut' }
    );
  }

  stopMotion(): void {
    this.scaleTween?.kill();
    this.scaleTween = null;
  }

  /** Разовый проход анимации вместо текущей. */
  private playOnce(animation: string): Promise<void> {
    this.playId += 1;

    return this.actor ? this.actor.play(animation, false) : Promise.resolve();
  }

  /** Разовый проход, затем покой своей стадии - если его не сменил другой проход. */
  private playThenIdle(animation: string): void {
    const played = this.playOnce(animation);
    const id = this.playId;

    void played.then(() => {
      if (this.playId === id) {
        this.idle();
      }
    });
  }

  private destroyContext(display: Container): ICellDestroyContext {
    return {
      motion: this.motion,
      display,
      baseScale: this.baseScale,
      burst: () => {
        this.place.runtime.fx.emitDestroyBurst(
          display.x,
          display.y,
          resolveDestroyTint(this.place.id)
        );
      },
    };
  }

  private applyTint(): void {
    const display = this.display;

    if (!display) return;

    display.tint = this.overlayTint ?? this.look.tint?.(this.hp) ?? NO_TINT;
  }

  private playScaleTween(props: IDisplayTweenProps, options: ITweenOptions): void {
    this.stopMotion();

    const tween = addDisplayTween(this.motion, this.display, props, options);

    this.scaleTween = tween;
    void tween.finished.then(() => {
      if (this.scaleTween === tween) {
        this.scaleTween = null;
      }
    });
  }
}
