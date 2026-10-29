import { getElementStageTexture, getElementStageTint } from '@/entities/skin';
import { tweenDisplay } from '../../motion/displayMotion';
import { BASE_SCALE, BoardEntity } from './BoardEntity';
import type { ICellLook } from './views/cellView';

const FADE_MS = 200;

/**
 * Ящик: неподвижный блокер в 1-3 слоя (`layers` уровня). Снимается брызгом от
 * матча рядом и прямым ударом; каждый удар - слой. Стадии (текстура и тинт по
 * оставшимся слоям) - из скина (`stages`, `stageTints`).
 */
export class CargoEntity extends BoardEntity {
  protected override look(): ICellLook {
    return {
      texture: (hp) => getElementStageTexture('cargo', hp),
      tint: (hp) => getElementStageTint('cargo', hp),
      baseScale: BASE_SCALE,
      destroy: async ({ motion, display, burst }) => {
        burst();
        await tweenDisplay(motion, display, { alpha: 0 }, { duration: FADE_MS, ease: 'Linear' });
      },
    };
  }

  protected override readonly acceptsInput = false;

  override canSwap(): boolean {
    return false;
  }
}
