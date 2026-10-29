import { AnimatedSprite, type Sprite, type Texture } from 'pixi.js';
import type { ISkinFrameClip, TSkinCellView } from '@/entities/skin';
import { resolveClipFrames, resolveClipRepeat } from '../../../lib/frameClip';
import type { IMotionTween } from '../../../motion/RuntimeMotion';
import type { ICellLook, ICellViewPlace } from './cellView';
import { SpriteCellView } from './SpriteCellView';

type TFramesSpec = Extract<TSkinCellView, { kind: 'frames' }>;

/**
 * Покадровый вид клетки: тот же спрайт, что `SpriteCellView`, но
 * `AnimatedSprite`, и на крючках покоя, появления, удара и разрушения он
 * играет клипы из скина (`ISkinElementBoard.view.clips`). Чего в клипах нет,
 * играется твинами спрайта - покадровым можно сделать только покой, не
 * переписывая остального.
 *
 * Кадры - из спрайт-листа (`ISkinTextureFile.frameHeight`): загрузчик режет
 * его при загрузке (`loadSkinTextures`, `TextureRegistry.frames`). Масштаб -
 * тот же `baseScale` элемента, то есть кадр листа рисуется шириной кадра
 * клетки.
 *
 * Кадры клипа ведут не собственные часы `AnimatedSprite` (общий тикер Pixi
 * шёл бы и на паузе партии, и мимо ускорения финала), а твин номера кадра на
 * часах рантайма: пауза, `timeScale` и уничтожение партии действуют на клип
 * так же, как на любой другой твин доски.
 */
export class FrameCellView extends SpriteCellView {
  private readonly clips: TFramesSpec['clips'];
  /** Твин клипа, который сейчас играет: новый клип сменяет его. */
  private clipTween: IMotionTween | null = null;
  /**
   * Номер последнего запущенного клипа. Сменённый клип тоже резолвит свой
   * промис, и без проверки номера его продолжение (возврат к покою) убило бы
   * клип, который его сменил, - например, разрушение.
   */
  private clipId = 0;

  constructor(place: ICellViewPlace, look: ICellLook, spec: TFramesSpec) {
    super(place, look);
    this.clips = spec.clips;
  }

  protected override createDisplay(textureKey: string): Sprite {
    const sprite = new AnimatedSprite({
      textures: [this.textureOf(textureKey)],
      autoUpdate: false,
    });

    return sprite;
  }

  override dispose(): void {
    this.clipTween?.kill();
    this.clipTween = null;
    super.dispose();
  }

  override idle(): void {
    super.idle();
    this.loop();
  }

  override async appear(): Promise<void> {
    const { appear } = this.clips;

    if (appear) {
      this.playThenLoop(appear);
    }

    await super.appear();
  }

  override hit(hpLeft: number): void {
    super.hit(hpLeft);

    const { hit } = this.clips;

    if (hit && hpLeft > 0) {
      this.playThenLoop(hit);
    }
  }

  /**
   * Клип разрушения заменяет схлопывание целиком: частицы - на его старте,
   * спрайт снимается по концу клипа.
   */
  override destroy(): Promise<void> | void {
    const { destroy } = this.clips;
    const sprite = this.sprite;

    if (!destroy || !sprite) {
      return super.destroy();
    }

    this.stopMotion();
    this.destroyContext(sprite).burst();

    return this.playOnce(destroy);
  }

  private get sprite(): AnimatedSprite | null {
    const image = this.image;

    return image instanceof AnimatedSprite && !image.destroyed ? image : null;
  }

  /** Клип покоя, если он есть; без него спрайт стоит на первом кадре текстуры. */
  private loop(): void {
    const { idle } = this.clips;

    if (idle && this.sprite) {
      void this.playClip(idle).finished;
    }
  }

  /** Один проход клипа и возврат к покою - если клип не сменили раньше. */
  private playThenLoop(clip: ISkinFrameClip): void {
    const finished = this.playOnce(clip);
    const id = this.clipId;

    void finished.then(() => {
      if (id === this.clipId) {
        this.loop();
      }
    });
  }

  /**
   * Один проход клипа. Резолвится по концу, по смене клипа или снятию
   * спрайта (твин останавливается) или по страховке часов рантайма: ждущий
   * каскад не должен повиснуть на клипе, которого не будет.
   */
  private playOnce(clip: ISkinFrameClip): Promise<void> {
    return this.sprite ? this.playClip({ ...clip, repeat: 0 }).finished : Promise.resolve();
  }

  private playClip(clip: ISkinFrameClip): IMotionTween {
    const sprite = this.sprite;

    this.clipId += 1;
    this.clipTween?.kill();
    this.clipTween = null;

    if (!sprite) {
      return { finished: Promise.resolve(), kill: () => undefined };
    }

    const sheet = this.place.runtime.core.textures.frames(clip.texture);
    const textures: Texture[] = resolveClipFrames(sheet.length, clip.frames).map(
      (index) => sheet[index]
    );

    if (textures.length === 0) {
      return { finished: Promise.resolve(), kill: () => undefined };
    }

    sprite.textures = textures;
    sprite.currentFrame = 0;

    const counter = { frame: 0 };
    const tween = this.motion.add(
      counter,
      { frame: textures.length },
      {
        duration: (textures.length / Math.max(1, clip.frameRate)) * 1000,
        repeat: resolveClipRepeat(clip.repeat),
        ease: 'Linear',
        onUpdate: () => {
          if (!sprite.destroyed) {
            sprite.currentFrame = Math.min(textures.length - 1, Math.floor(counter.frame));
          }
        },
      }
    );

    this.clipTween = tween;

    return tween;
  }
}
