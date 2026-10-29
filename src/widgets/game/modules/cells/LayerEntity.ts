import { Sprite, type Container } from 'pixi.js';
import { getElementStageTexture, getElementTexture, skinTextureWidth } from '@/entities/skin';
import { GAME_CONFIG } from '../../configs/GAME_CONFIG';
import type { IGoalFlightTarget } from '../../fx/boardFx';
import { cellCenter } from '../../lib/boardGeometry';
import { resolveDestroyTint } from '../../lib/destroyTint';
import { destroyDisplay, tweenDisplay } from '../../motion/displayMotion';
import type { ICellRuntime } from './cellsTypes';

export type TLayerId = 'ice' | 'chain' | 'floor';

/**
 * Масштаб слоя - «дизайн-px / ширина текстуры». Текстура по оставшейся
 * прочности - из скина (`ISkinElementBoard.stages`: у льда и подложки две
 * стадии, у цепи одна). Накладки - в размер фишки, подложка - в размер плитки
 * поля.
 */
const LAYER_SCALE: Record<TLayerId, number> = {
  ice: GAME_CONFIG.iceScaleTiles,
  chain: GAME_CONFIG.cellsSize / skinTextureWidth(getElementTexture('chain')),
  floor: GAME_CONFIG.tile.size.width / skinTextureWidth(getElementTexture('floor')),
};

const FADE_MS = 200;
const APPEAR_MS = 250;

/**
 * Спрайт слоя клетки - накладки (лёд, цепь) над фишкой или подложки под ней.
 *
 * Не `BoardEntity`: слой не двигается, не ловит касаний и не падает - он
 * только показывает прочность и гаснет. Цель уровня по нему засчитывает, как
 * и по предмету, проигрыватель шагов (`listGoalEvents`); слой только рисует
 * полёт копии к панели (`flyCopyToGoalPanel`).
 * Над какой клеткой он лежит, решает слой контейнера доски, в который его
 * положил `BoardStepPlayer` (подложки - под фишками, накладки - над ними).
 */
export class LayerEntity {
  readonly id: TLayerId;
  private readonly runtime: ICellRuntime;
  private hp: number;
  private textureKey: string;
  private image: Sprite | null;

  constructor(
    runtime: ICellRuntime,
    container: Container,
    { id, hp, col, row }: { id: TLayerId; hp: number; col: number; row: number }
  ) {
    this.runtime = runtime;
    this.id = id;
    this.hp = hp;
    this.textureKey = getElementStageTexture(id, hp);

    const center = cellCenter({ col, row });
    const image = new Sprite(runtime.core.textures.get(this.textureKey));

    image.anchor.set(0.5);
    image.position.set(center.x, center.y);
    image.scale.set(LAYER_SCALE[id]);
    image.alpha = 0;
    container.addChild(image);
    this.image = image;
  }

  private get motion() {
    return this.runtime.core.motion;
  }

  /** Появление вместе с доской на старте партии. */
  appear(): Promise<void> {
    const image = this.image;

    if (!image) {
      return Promise.resolve();
    }

    image.scale.set(0);
    image.alpha = 1;

    return tweenDisplay(
      this.motion,
      image,
      { scale: LAYER_SCALE[this.id] },
      { duration: APPEAR_MS, ease: 'Back.easeOut' }
    );
  }

  /** Прочность после удара (её уже решил движок): стадия или разрушение. */
  takeDamage(hpLeft: number): void {
    this.hp = hpLeft;

    if (this.hp <= 0) {
      void this.destroy();
      return;
    }

    const textureKey = getElementStageTexture(this.id, this.hp);

    if (this.image && textureKey !== this.textureKey) {
      this.image.texture = this.runtime.core.textures.get(textureKey);
      this.textureKey = textureKey;
    }
  }

  /**
   * Шаг цели засчитан: копия слоя (в его текущей стадии) взлетает к панели
   * целей. Зовёт проигрыватель шагов до урона - см. `BoardEntity.flyCopyToGoalPanel`.
   */
  flyCopyToGoalPanel(target: IGoalFlightTarget | null): void {
    if (this.image) {
      this.runtime.fx.flyToGoalPanel(this.image, this.textureKey, target);
    }
  }

  private async destroy(): Promise<void> {
    const image = this.image;

    if (!image) return;

    this.runtime.fx.emitDestroyBurst(image.x, image.y, resolveDestroyTint(this.id));

    await tweenDisplay(this.motion, image, { alpha: 0 }, { duration: FADE_MS, ease: 'Linear' });
    this.dispose();
  }

  dispose(): void {
    destroyDisplay(this.motion, this.image);
    this.image = null;
  }
}
