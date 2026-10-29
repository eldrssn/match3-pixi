import type { Sprite } from 'pixi.js';
import { getElementTexture } from '@/entities/skin';
import { addDisplayTween } from '../../motion/displayMotion';
import type { IMotionTween, RuntimeMotion } from '../../motion/RuntimeMotion';
import { BASE_SCALE } from './BoardEntity';
import { SpecialEntity } from './SpecialEntity';

/** Полный оборот колеса: вращение отличает радугу от неподвижных фишек. */
const SPIN_MS = 4000;

/**
 * Радуга: рождается из линии 5, снимает все фишки одного цвета. Выглядит как
 * медленно вращающееся цветовое колесо из цветов фишек - в скине по
 * умолчанию процедурная текстура `rainbowWheel` (`skins/default/art/boardArt`).
 */
export class RainbowEntity extends SpecialEntity {
  protected readonly restingTexture = getElementTexture('rainbow');
  protected readonly restingScale = BASE_SCALE;

  /**
   * Вращение - свой твин на угол: масштаб и позицию анимации доски пишут
   * своими твинами, и угол им не мешает. Снимает его вид вместе со спрайтом.
   */
  protected override decorate(image: Sprite, motion: RuntimeMotion): IMotionTween {
    return addDisplayTween(
      motion,
      image,
      { angle: 360 },
      { duration: SPIN_MS, repeat: -1, ease: 'Linear' }
    );
  }
}
