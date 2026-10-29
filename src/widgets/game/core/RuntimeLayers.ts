import { Container } from 'pixi.js';

/**
 * Слои сцены партии - в порядке отрисовки: каждый следующий поверх
 * предыдущего (порядок `addChild`). Имена те же, что у `LayerManager`
 * Phaser-эталона, - модули фаз 2-3 переносятся с ним и кладут себя по имени.
 */
export const RUNTIME_LAYER_NAMES = [
  'Background',
  'GameBoard',
  'TopMenu',
  'TopMenuCenter',
  'BottomMenu',
] as const;

export type TRuntimeLayerName = (typeof RUNTIME_LAYER_NAMES)[number];

/**
 * Контейнеры слоёв под корнем сцены. `sortableChildren` и у корня, и у слоёв:
 * глубины эталона (`setDepth`, `configs/sceneDepths`) переносятся числами в
 * `zIndex` - затемнение интро, панель целей и полёт цели обязаны ложиться
 * друг на друга тем же порядком.
 *
 * Реестр имён живёт ровно одну партию: он создаётся вместе с ядром и
 * уничтожается вместе со сценой, поэтому «слой уже существует» на
 * перезапуске у Pixi-версии не бывает.
 */
export class RuntimeLayers {
  private readonly layers = new Map<TRuntimeLayerName, Container>();

  constructor(stage: Container) {
    stage.sortableChildren = true;

    RUNTIME_LAYER_NAMES.forEach((name) => {
      const layer = new Container({ label: name, sortableChildren: true });

      stage.addChild(layer);
      this.layers.set(name, layer);
    });
  }

  get(name: TRuntimeLayerName): Container {
    const layer = this.layers.get(name);

    if (!layer) {
      throw new Error(`[game] нет слоя "${name}"`);
    }

    return layer;
  }
}
