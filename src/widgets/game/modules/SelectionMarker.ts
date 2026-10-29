import { Graphics, type Container } from 'pixi.js';
import { SKIN } from '@/entities/skin';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { BOARD_TIMING } from '../configs/timing';
import { addDisplayTween, destroyDisplay } from '../motion/displayMotion';
import type { IMotionTween, RuntimeMotion } from '../motion/RuntimeMotion';
import type { BoardEntity } from './cells/BoardEntity';

/** Рамка выбранной клетки: нейтральная, как выбранный бустер на карточке уровня. */
const SELECTION_COLOR = SKIN.colors.fx.selection;
const SELECTION_STROKE = 4;
const SELECTION_RADIUS = 12;

/**
 * Выбор первого тапа хода двумя тапами (`lib/tapSelection`): какая фишка
 * выбрана и рамка над ней, мягко дышащая, пока ждёт второй тап.
 *
 * Что делать с тапом, решает `GameLogic`; модуль только помнит выбор и
 * рисует его. Рамка лежит в контейнере доски поверх слоёв клеток - её
 * создают после `BoardStepPlayer`, который кладёт слои раньше.
 */
export class SelectionMarker {
  private readonly motion: RuntimeMotion;
  private readonly marker: Graphics;
  private tween: IMotionTween | null = null;
  private selected: BoardEntity | null = null;

  constructor(motion: RuntimeMotion, container: Container) {
    const size = GAME_CONFIG.tile.size.width;

    this.motion = motion;
    this.marker = new Graphics()
      .roundRect(-size / 2, -size / 2, size, size, SELECTION_RADIUS)
      .stroke({ width: SELECTION_STROKE, color: SELECTION_COLOR, alpha: 1 });
    this.marker.visible = false;
    container.addChild(this.marker);
  }

  /** Выбранная фишка; `null` - выбора нет. */
  get entity(): BoardEntity | null {
    return this.selected;
  }

  select(entity: BoardEntity): void {
    this.clear();
    this.selected = entity;

    const { visualX, visualY } = entity.getVisualCoords();

    this.marker.position.set(visualX, visualY);
    this.marker.alpha = 1;
    this.marker.visible = true;
    this.tween = addDisplayTween(
      this.motion,
      this.marker,
      { alpha: 0.45 },
      { duration: BOARD_TIMING.idle.pulseMs, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }
    );
  }

  clear(): void {
    this.selected = null;
    this.tween?.kill();
    this.tween = null;

    if (!this.marker.destroyed) {
      this.marker.visible = false;
    }
  }

  destroy(): void {
    this.clear();
    destroyDisplay(this.motion, this.marker);
  }
}
