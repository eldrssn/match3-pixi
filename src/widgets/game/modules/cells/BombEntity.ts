import { getElementTexture } from '@/entities/skin';
import { CELL_TEXTURE_WIDTH } from '../../configs/GAME_CONFIG';
import { SpecialEntity } from './SpecialEntity';

/**
 * Бомба: рождается из фигуры L/T, бьёт квадрат 3×3 вокруг себя
 * (`IBoardFx.playAreaBlast`).
 */
export class BombEntity extends SpecialEntity {
  /** Кадр атласа без полей: 44 дизайн-px оставляют фитилю зазор до края клетки. */
  protected readonly restingTexture = getElementTexture('bomb');
  protected readonly restingScale = 44 / CELL_TEXTURE_WIDTH;
}
