import { getElementTexture } from '@/entities/skin';
import { CELL_TEXTURE_WIDTH } from '../../configs/GAME_CONFIG';
import { SpecialEntity } from './SpecialEntity';

/**
 * Пропеллер: рождается из квадрата 2×2, бьёт крест вокруг себя и улетает в
 * приоритетную цель (`IBoardFx.playPropellerFlight`).
 */
export class PropellerEntity extends SpecialEntity {
  /** Кадр атласа без полей - в рост бомбы, чтобы спецфишки читались одним рядом. */
  protected readonly restingTexture = getElementTexture('propeller');
  protected readonly restingScale = 44 / CELL_TEXTURE_WIDTH;
}
