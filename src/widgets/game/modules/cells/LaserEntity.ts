import type { Sprite } from 'pixi.js';
import { getElementTexture, SKIN } from '@/entities/skin';
import { BASE_SCALE, type IBoardEntityPlace } from './BoardEntity';
import { SpecialEntity } from './SpecialEntity';

/**
 * Ракета (лазер): рождается из линии 4, чистит строку или колонку. Текстура
 * одна на оба направления: вертикальная - это тот же спрайт, повёрнутый на
 * 90° (`decorate`), отдельного ассета под неё нет.
 */
export class LaserEntity extends SpecialEntity {
  public direction: 'horizontal' | 'vertical';

  protected readonly restingTexture = getElementTexture('laser');
  protected readonly restingScale = BASE_SCALE;

  private isAnimating = false;

  constructor(
    id: 'laser',
    hp: number,
    direction: 'horizontal' | 'vertical',
    place: IBoardEntityPlace
  ) {
    super(id, hp, place);
    this.direction = direction;
  }

  protected override decorate(image: Sprite): null {
    image.angle = this.direction === 'vertical' ? 90 : 0;

    return null;
  }

  /**
   * Выстрел ракеты со своей клетки: спрайт вспыхивает (своего «активного» арта
   * у ракеты нет - цвет вспышки из скина), и из него расходятся два луча
   * (`IBoardFx.playBeamSequence`).
   */
  public async laserAnimate(): Promise<void> {
    const image = this.image;

    if (this.isAnimating || !image) return;
    this.isAnimating = true;

    // Подсветка держит свой тинт и твин на спрайте: снимаем её до вспышки.
    this.unhighlightSpecial();
    this.input.setEnabled(false);

    const { x, y, angle } = image;

    this.view.tint(SKIN.colors.fx.rocketFiring);

    await this.runtime.fx.playBeamSequence({ x, y }, angle);

    this.isAnimating = false;
    this.input.setEnabled(true);
  }
}
