import { getElementTexture } from '@/entities/skin';
import { TILE_STEP_X, TILE_STEP_Y } from '../../lib/boardGeometry';
import { tweenDisplay } from '../../motion/displayMotion';
import { BASE_SCALE, BoardEntity } from './BoardEntity';
import type { ICellLook } from './views/cellView';

/** Насколько слизь «набухает», заняв соседнюю клетку, - доля базового масштаба. */
const SPREAD_SWELL = 1.18;
const SPREAD_MS = 320;

/**
 * Слизь: неподвижный блокер, который снимается и матчем рядом, и прямым
 * ударом, а после хода, в котором её не тронули, расползается на соседнюю
 * фишку. Правила - в движке (`BoardEngine.spreadSlime`), здесь только вид.
 */
export class SlimeEntity extends BoardEntity {
  protected override look(): ICellLook {
    return {
      texture: () => getElementTexture('slime'),
      baseScale: BASE_SCALE,
      destroy: async ({ motion, display, baseScale, burst }) => {
        burst();
        await tweenDisplay(
          motion,
          display,
          { alpha: 0, scaleX: baseScale * 1.3, scaleY: baseScale * 0.6 },
          { duration: 220, ease: 'Quad.easeOut' }
        );
      },
    };
  }

  protected override readonly acceptsInput = false;

  override canSwap(): boolean {
    return false;
  }

  /**
   * Новая клетка слизи: выползает из соседней клетки `from` - стартует на их
   * границе маленькой и доезжает до своей клетки, набухая, а потом
   * шлёпается в размер с перелётом.
   */
  public async playSpread(from: { col: number; row: number }): Promise<void> {
    const image = this.image;

    if (!image) {
      return;
    }

    const { visualX, visualY } = this.getVisualCoords();
    const { motion } = this.runtime.core;

    image.position.set(
      visualX + ((from.col - this.x) * TILE_STEP_X) / 2,
      visualY + ((from.row - this.y) * TILE_STEP_Y) / 2
    );
    image.scale.set(BASE_SCALE * 0.3);
    image.alpha = 1;

    await tweenDisplay(
      motion,
      image,
      { x: visualX, y: visualY, scale: BASE_SCALE * SPREAD_SWELL },
      { duration: SPREAD_MS * 0.6, ease: 'Quad.easeOut' }
    );
    await tweenDisplay(
      motion,
      image,
      { scale: BASE_SCALE },
      { duration: SPREAD_MS * 0.4, ease: 'Back.easeOut' }
    );
  }
}
