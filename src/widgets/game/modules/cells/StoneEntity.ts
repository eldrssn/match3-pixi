import { getElementTexture } from '@/entities/skin';
import { tweenDisplay } from '../../motion/displayMotion';
import { BASE_SCALE, BoardEntity } from './BoardEntity';
import type { ICellLook } from './views/cellView';

/**
 * Камень: неподвижный блокер, которого берут только спецфишки и бустеры -
 * матч рядом его не задевает (правило - в движке, здесь только вид).
 */
export class StoneEntity extends BoardEntity {
  protected override look(): ICellLook {
    return {
      texture: () => getElementTexture('stone'),
      baseScale: BASE_SCALE,
      destroy: async ({ motion, display, baseScale, burst }) => {
        burst();
        await tweenDisplay(
          motion,
          display,
          { alpha: 0, scale: baseScale * 1.2 },
          { duration: 220, ease: 'Linear' }
        );
      },
    };
  }

  protected override readonly acceptsInput = false;

  override canSwap(): boolean {
    return false;
  }
}
