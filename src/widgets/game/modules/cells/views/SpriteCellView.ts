import { Sprite, type Container } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import { BOARD_TIMING } from '../../../configs/timing';
import { resolveDestroyTint } from '../../../lib/destroyTint';
import {
  addDisplayTween,
  destroyDisplay,
  tweenDisplay,
  type IDisplayTweenProps,
} from '../../../motion/displayMotion';
import type { IMotionTween, ITweenOptions, RuntimeMotion } from '../../../motion/RuntimeMotion';
import { collapseMotion } from './cellMotions';
import type {
  ICellDestroyContext,
  ICellFallScale,
  ICellLook,
  ICellView,
  ICellViewPlace,
} from './cellView';

export const PRESS_SCALE = 1.15;
export const LAND_SQUASH_SCALE_X = 1.12;
export const LAND_SQUASH_SCALE_Y = 0.88;
/** Амплитуда пульса подсказки простоя относительно базового масштаба. */
export const IDLE_PULSE_SCALE = 1.08;
/** Появление клетки на старте партии и при доборе на месте. */
export const APPEAR_MS = 250;
/**
 * Вытяжка спрайта на максимальной скорости падения, в долях базового
 * масштаба. Обратный `scaleX` держит объём: фишка вытягивается, а не
 * раздувается.
 */
const FALL_STRETCH_MAX = 1.18;
/** С какой дистанции вытяжка выходит на максимум. */
const FALL_STRETCH_FULL_ROWS = 4;
/** Подсветка спецфишки - выхода из тупика: полуволна мерцания и нижняя прозрачность. */
export const HIGHLIGHT_PULSE_MS = 500;
export const HIGHLIGHT_MIN_ALPHA = 0.5;
/** Тинт «без тинта» у Pixi - белый множитель. */
export const NO_TINT = 0xffffff;

/** Насколько вытянется фишка, пролетев `fallDistance` строк. */
export const resolveFallStretch = (fallDistance: number): number =>
  1 +
  ((FALL_STRETCH_MAX - 1) * Math.min(Math.max(fallDistance, 0), FALL_STRETCH_FULL_ROWS)) /
    FALL_STRETCH_FULL_ROWS;

/**
 * Вид клетки по умолчанию: спрайт с текстурой покоя (или стадии) и анимации
 * твинами - нажатие, squash приземления, пульс подсказки, замах и
 * схлопывание.
 *
 * Новый вид клетки удобнее всего наследовать отсюда и переопределять только
 * свои крючки - так делает покадровый `FrameCellView`.
 */
export class SpriteCellView implements ICellView {
  protected readonly motion: RuntimeMotion;
  protected readonly container: Container;
  protected readonly place: ICellViewPlace;
  protected readonly look: ICellLook;
  protected image: Sprite | null = null;
  protected hp = 1;
  /** Ключ текстуры, которая сейчас на спрайте: смена стадии - только по разнице. */
  private textureKey = '';

  /**
   * Собственный scale-твин клетки: нажатие пальцем, squash при приземлении,
   * пульс подсказки, выскок спецфишки.
   *
   * Держится ручкой, чтобы гасить именно его. Снять все твины спрайта снесло
   * бы и чужие - падение, свап, - а позицию фишке задаёт только твин: она
   * осталась бы висеть мимо своей клетки.
   */
  private scaleTween: IMotionTween | null = null;

  /**
   * Тот же `scaleTween`, но пойманный в момент запуска пульса подсказки
   * простоя. Нужен только чтобы `pulse(false)` понял, свой ли твин он гасит:
   * пока пульс идёт, спрайт мог перехватить press или squash, и сбрасывать их
   * масштаб в базовый нельзя.
   */
  private pulseTween: IMotionTween | null = null;
  /** Твин украшения покоя (`ICellLook.decorate`): уходит вместе со спрайтом. */
  private decorationTween: IMotionTween | null = null;
  private isDecorated = false;
  private highlightTween: IMotionTween | null = null;
  private isHighlighted = false;
  /** Тинт поверх стадии (подсветка, вспышка ракеты); `null` - тинт стадии. */
  private overlayTint: number | null = null;

  constructor(place: ICellViewPlace, look: ICellLook) {
    this.place = place;
    this.motion = place.runtime.core.motion;
    this.container = place.container;
    this.look = look;
  }

  get display(): Sprite | null {
    return this.image;
  }

  get baseScale(): number {
    return this.look.baseScale;
  }

  get restTexture(): string {
    return this.look.texture(this.hp);
  }

  create(x: number, y: number, hp: number): void {
    this.dispose();
    this.hp = hp;

    const textureKey = this.look.texture(hp);
    const image = this.createDisplay(textureKey);

    if (this.look.nearestFilter) {
      image.texture.source.scaleMode = 'nearest';
    }

    image.anchor.set(0.5);
    image.position.set(x, y);
    image.scale.set(this.baseScale);
    image.alpha = 0;
    this.container.addChild(image);
    this.image = image;
    this.textureKey = textureKey;
    this.applyTint();
    this.idle();
  }

  /** Сам объект на доске: здесь `Sprite`, у покадрового вида - `AnimatedSprite`. */
  protected createDisplay(textureKey: string): Sprite {
    return new Sprite(this.textureOf(textureKey));
  }

  protected textureOf(key: string) {
    return this.place.runtime.core.textures.get(key);
  }

  dispose(): void {
    // Твин пишет в свою цель каждый кадр, а Pixi бросает на записи в снятый
    // объект: сначала твины, потом спрайт.
    this.stopMotion();
    this.decorationTween?.kill();
    this.decorationTween = null;
    this.isDecorated = false;
    this.highlightTween?.kill();
    this.highlightTween = null;
    this.isHighlighted = false;
    this.overlayTint = null;
    this.pulseTween = null;
    destroyDisplay(this.motion, this.image);
    this.image = null;
  }

  async appear(): Promise<void> {
    const image = this.image;

    if (!image) return;

    image.scale.set(0);
    image.alpha = 1;

    await tweenDisplay(
      this.motion,
      image,
      { scale: this.baseScale },
      { duration: APPEAR_MS, ease: 'Back.easeOut' }
    );
  }

  /**
   * `Back.easeOut` из нуля даёт выскок с перелётом и посадкой: заработанная
   * награда обязана быть заметнее, чем просто появиться посреди каскада.
   */
  spawn(): void {
    const image = this.image;

    if (!image) return;

    image.scale.set(0);
    image.alpha = 1;

    this.playScaleTween(
      { scale: this.baseScale },
      { duration: BOARD_TIMING.special.spawnMs, ease: 'Back.easeOut' }
    );
  }

  /**
   * Украшение покоя - один раз на спрайт: вращение радуги - бесконечный твин,
   * и повторный вызов (снятие подсветки) иначе крутил бы её вдвое быстрее.
   */
  idle(): void {
    const image = this.image;

    if (!image || this.isDecorated) return;

    this.isDecorated = true;
    this.decorationTween = this.look.decorate?.(image, this.motion) ?? null;
  }

  /**
   * Нажатая фишка «набухает» твином, а не прыгает мгновенно: разовый
   * масштаб читался бы как дёрганье кадра, твин даёт мягкий отклик на палец.
   */
  press(): void {
    if (!this.image) return;

    this.playScaleTween(
      { scale: this.baseScale * PRESS_SCALE },
      { duration: BOARD_TIMING.input.pressMs, ease: 'Sine.easeOut' }
    );
  }

  release(): void {
    // Пресс-твин мог не доиграть (короткий тап) - глушим, иначе он
    // перетирал бы сброс масштаба в базовый.
    this.stopMotion();
    this.image?.scale.set(this.baseScale);
    // Своей подсветки у жеста нет, но сброс остаётся страховкой: жест мог
    // начаться на клетке, которую в этот момент подсвечивал наведённый
    // бустер, и та подсветка пережила бы жест.
    this.bright(false);
  }

  /**
   * Мягкий бесконечный пульс подсказки простоя. Идёт через общий scale-твин, а
   * не своим: иначе press и пульс писали бы в один масштаб каждый кадр.
   *
   * Снятие возвращает базовый масштаб: остановка твина значение не
   * откатывает. Если пульс уже перехватил другой scale-твин (нажатие,
   * squash) - не трогаем ничего: чужой масштаб не наш.
   */
  pulse(isOn: boolean): void {
    const image = this.image;

    if (isOn) {
      if (!image) return;

      this.playScaleTween(
        { scale: this.baseScale * IDLE_PULSE_SCALE },
        { duration: BOARD_TIMING.idle.pulseMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }
      );
      this.pulseTween = this.scaleTween;

      return;
    }

    const pulse = this.pulseTween;
    this.pulseTween = null;

    if (!pulse || this.scaleTween !== pulse) return;

    this.stopMotion();
    image?.scale.set(this.baseScale);
  }

  /**
   * Аддитивное наложение осветляет весь квад текстуры, а не рисунок, поэтому
   * подсветка - только у наведённого бустера, где это единственный признак
   * «во что целюсь».
   */
  bright(isOn: boolean): void {
    const image = this.image;

    if (!image) return;

    if (isOn) {
      image.blendMode = 'add';
      image.tint = SKIN.colors.fx.cellBright;

      return;
    }

    image.blendMode = 'normal';
    this.applyTint();
  }

  /**
   * Идемпотентна: каждый ход без возможных комбинаций иначе вешал бы на тот же
   * спрайт ещё один вечный твин, и подсветка накапливалась бы.
   */
  highlight(isOn: boolean): void {
    const image = this.image;

    if (isOn) {
      if (this.isHighlighted || !image) return;

      this.isHighlighted = true;
      this.overlayTint = SKIN.colors.fx.specialHint;
      this.applyTint();
      image.alpha = HIGHLIGHT_MIN_ALPHA;
      this.highlightTween = addDisplayTween(
        this.motion,
        image,
        { alpha: 1 },
        { duration: HIGHLIGHT_PULSE_MS, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }
      );

      return;
    }

    if (!this.isHighlighted) return;

    this.isHighlighted = false;
    // Именно свой твин: снять все твины спрайта значило бы оборвать заодно
    // падение и перелёт фишки.
    this.highlightTween?.kill();
    this.highlightTween = null;
    this.overlayTint = null;

    if (!image) return;

    this.applyTint();
    image.alpha = 1;
  }

  tint(color: number | null): void {
    this.overlayTint = color;
    this.applyTint();
  }

  hit(hpLeft: number): void {
    this.hp = hpLeft;

    const image = this.image;

    if (!image || hpLeft <= 0) return;

    const textureKey = this.look.texture(hpLeft);

    if (this.textureKey !== textureKey) {
      image.texture = this.textureOf(textureKey);
      this.textureKey = textureKey;
    }

    this.applyTint();
  }

  destroy(): Promise<void> | void {
    const image = this.image;

    if (!image) return;

    // Squash-твин от приземления мог ещё жить: он перетирал бы масштаб
    // замаха и схлопывания.
    this.stopMotion();

    return (this.look.destroy ?? collapseMotion)(this.destroyContext(image));
  }

  /**
   * В цель не засчитывается и частиц не даёт - её никто не собирал, она
   * просто исчезает.
   */
  async vanish(): Promise<void> {
    this.stopMotion();

    await tweenDisplay(
      this.motion,
      this.image,
      { scale: 0, alpha: 0 },
      { duration: BOARD_TIMING.destroy.anticipationMs * 2, ease: 'Quad.easeIn' }
    );
  }

  fallScale(rows: number): ICellFallScale {
    const stretch = resolveFallStretch(rows);

    return { scaleX: this.baseScale / stretch, scaleY: this.baseScale * stretch };
  }

  /** Приземление «сплющивает» фишку, и она распрямляется обратно. */
  land(): void {
    const image = this.image;

    if (!image) return;

    image.scale.set(this.baseScale * LAND_SQUASH_SCALE_X, this.baseScale * LAND_SQUASH_SCALE_Y);
    this.playScaleTween(
      { scaleX: this.baseScale, scaleY: this.baseScale },
      { duration: BOARD_TIMING.fall.landSquashMs, ease: 'Back.easeOut' }
    );
  }

  stopMotion(): void {
    this.scaleTween?.kill();
    this.scaleTween = null;
  }

  /** Что получает анимация разрушения: часы, спрайт, его масштаб и сноп частиц. */
  protected destroyContext(image: Sprite): ICellDestroyContext {
    return {
      motion: this.motion,
      display: image,
      baseScale: this.baseScale,
      burst: () => {
        this.place.runtime.fx.emitDestroyBurst(image.x, image.y, resolveDestroyTint(this.place.id));
      },
    };
  }

  /** Тинт поверх стадии, иначе тинт стадии по прочности, иначе без тинта. */
  private applyTint(): void {
    const image = this.image;

    if (!image) return;

    image.tint = this.overlayTint ?? this.look.tint?.(this.hp) ?? NO_TINT;
  }

  /**
   * Заводит собственный scale-твин клетки взамен предыдущего. Ручка
   * обнуляется по завершении - иначе `stopMotion()` пришёлся бы по уже
   * отыгравшему твину.
   */
  private playScaleTween(props: IDisplayTweenProps, options: ITweenOptions): void {
    this.stopMotion();

    const tween = addDisplayTween(this.motion, this.image, props, options);

    this.scaleTween = tween;
    void tween.finished.then(() => {
      if (this.scaleTween === tween) {
        this.scaleTween = null;
      }
    });
  }
}
