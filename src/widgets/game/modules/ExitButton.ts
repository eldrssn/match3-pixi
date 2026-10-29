import { Container, Sprite } from 'pixi.js';
import { skinTextureWidth } from '@/entities/skin';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport } from '../core/RuntimeEvents';
import { useGameStore } from '../store/GameStore';

/** Масштаб - дробь «дизайн-px / ширина текстуры `exit` из скина». */
const EXIT_DESIGN_WIDTH = 41;
const EXIT_SCALE = (EXIT_DESIGN_WIDTH / skinTextureWidth('exit')) * GAME_CONFIG.headerControlScale;

/** Отступ кнопки от левого края, дизайн-px. */
const EXIT_LEFT = 30;

/**
 * Кнопка выхода в левом углу шапки - порт `ExitButton` Phaser-эталона.
 *
 * Запрос выхода уходит хосту (`GameStore.exitButtonOnClick` ->
 * `onExitRequest`) на **отпускании** пальца, уже после того как рантайм его
 * обработал: смонтируй хост на `pointerdown` свой слой поверх доски и выключи
 * ввод, незакрытый жест остался бы висеть.
 */
export class ExitButton {
  private readonly container = new Container({ label: 'ExitButton' });
  private readonly button: Sprite;
  private readonly offResize: () => void;

  constructor(core: GameRuntimeCore) {
    core.layers.get('TopMenu').addChild(this.container);

    this.button = new Sprite(core.textures.get('exit'));
    this.button.scale.set(EXIT_SCALE);
    this.button.anchor.set(0.5);
    this.button.eventMode = 'static';
    this.button.on('pointerup', this.handleClick);
    this.container.addChild(this.button);

    this.offResize = core.events.on('resize', this.handleResize);
    this.handleResize(core.viewport);
  }

  private handleResize = ({ layout }: IRuntimeViewport): void => {
    this.container.scale.set(layout.scale);
    this.container.position.set(
      EXIT_LEFT * layout.scale,
      layout.top + GAME_CONFIG.topOffset * layout.scale
    );
  };

  private handleClick = (): void => {
    useGameStore.getState().exitButtonOnClick();
  };

  public destroy(): void {
    this.offResize();
    this.button.off('pointerup', this.handleClick);
    this.container.destroy({ children: true });
  }
}
