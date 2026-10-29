import { Container, Sprite } from 'pixi.js';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport } from '../core/RuntimeEvents';
import { createRuntimeText } from '../lib/runtimeText';
import { areBoostersHiddenForParty } from '../model/areBoostersHiddenForParty';
import { useLevelConfigStore } from '../store/levelConfigStore';
import { GAME_TEXTS } from '../texts';

const OFFSET_Y = GAME_CONFIG.boostersContainerOffsetY;

/**
 * Низ сцены: панель бустеров (`boostersBg`) и подпись уровня («Уровень N» или
 * `title` партии). Кнопки бустеров (`boosters/BoosterButton`) кладут себя в
 * этот же контейнер. Порт `BoostersContainer` Phaser-эталона.
 *
 * Партия без бустеров прячет только саму панель (кнопки прячут себя сами), а
 * не весь контейнер: подпись уровня к бустерам отношения не имеет.
 */
export class BoostersContainer {
  private readonly container = new Container({ label: 'BoostersContainer' });
  private readonly offResize: () => void;

  constructor(core: GameRuntimeCore) {
    core.layers.get('BottomMenu').addChild(this.container);

    const background = new Sprite(core.textures.get('boostersBg'));

    background.scale.set(0.25);
    background.anchor.set(0.5);
    background.y = OFFSET_Y;
    // Бустеры приходят до старта рантайма и внутри партии не меняются.
    background.visible = !areBoostersHiddenForParty();

    const { levelConfig, partyOptions } = useLevelConfigStore.getState();
    const levelName = createRuntimeText(
      partyOptions.title ?? GAME_TEXTS.hud.levelTitle(levelConfig?.id ?? ''),
      GAME_CONFIG.boosterNameTextConfig
    );

    levelName.y = OFFSET_Y - 60;
    this.container.addChild(background, levelName);

    this.offResize = core.events.on('resize', this.handleResize);
    this.handleResize(core.viewport);
  }

  /** Низ стоит на нижней границе безопасной зоны, а не на краю канваса. */
  private handleResize = ({ width, layout }: IRuntimeViewport): void => {
    this.container.scale.set(layout.scale);
    this.container.position.set(width / 2, layout.bottom);
  };

  public getContainer(): Container {
    return this.container;
  }

  public destroy(): void {
    this.offResize();
    this.container.destroy({ children: true });
  }
}
