import { Container, Sprite } from 'pixi.js';
import { skinTextureWidth } from '@/entities/skin';
import type { SoundEngine } from '../audio/SoundEngine';
import { writeSoundMuted } from '../audio/soundPreference';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport } from '../core/RuntimeEvents';

/** Текстуры кнопки из скина - на той же плашке, что выход. */
const SOUND_ON_TEXTURE = 'soundToggleOn';
const SOUND_OFF_TEXTURE = 'soundToggleOff';

/** Тот же размер на экране, что у кнопки выхода (`ExitButton`). */
const TOGGLE_SCALE = (41 / skinTextureWidth(SOUND_ON_TEXTURE)) * GAME_CONFIG.headerControlScale;

/**
 * Кнопка стоит в левом нижнем углу, на одной линии с панелью бустеров; отступ
 * от края - тот же, что у кнопки выхода.
 */
const TOGGLE_LEFT = 30;

/**
 * Кнопка звука в левом нижнем углу: включает и выключает весь звук партии и
 * запоминает выбор (`soundPreference`, ключ `STORAGE_KEYS`). Порт
 * `SoundToggle` Phaser-эталона; срабатывает на отпускании, как выход.
 */
export class SoundToggle {
  private readonly core: GameRuntimeCore;
  private readonly sound: SoundEngine;
  private readonly container = new Container({ label: 'SoundToggle' });
  private readonly button: Sprite;
  private readonly offResize: () => void;

  constructor(core: GameRuntimeCore, sound: SoundEngine) {
    this.core = core;
    this.sound = sound;
    core.layers.get('BottomMenu').addChild(this.container);

    this.button = new Sprite(core.textures.get(this.resolveTexture()));
    this.button.scale.set(TOGGLE_SCALE);
    this.button.anchor.set(0.5);
    this.button.eventMode = 'static';
    this.button.cursor = 'pointer';
    this.button.on('pointerup', this.toggle);
    this.container.addChild(this.button);

    this.offResize = core.events.on('resize', this.handleResize);
    this.handleResize(core.viewport);
  }

  destroy(): void {
    this.offResize();
    this.button.off('pointerup', this.toggle);
    this.container.destroy({ children: true });
  }

  private toggle = (): void => {
    const muted = !this.sound.isMuted;

    this.sound.setMuted(muted);
    writeSoundMuted(muted);
    this.button.texture = this.core.textures.get(this.resolveTexture());
  };

  private resolveTexture(): string {
    return this.sound.isMuted ? SOUND_OFF_TEXTURE : SOUND_ON_TEXTURE;
  }

  private handleResize = ({ layout }: IRuntimeViewport): void => {
    this.container.scale.set(layout.scale);
    this.container.position.set(
      TOGGLE_LEFT * layout.scale,
      layout.bottom + GAME_CONFIG.boostersContainerOffsetY * layout.scale
    );
  };
}
